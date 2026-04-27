import type { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StatusCodes } from "http-status-codes";

import logger from "../../config/logger.js";
import { createMcpServer } from "../server.js";
import { authorize } from "./auth.util.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const SESSION_TTL_MS = 60 * 60 * 1000; // 60 minutes
const SESSION_REAP_INTERVAL_MS = 5 * 60 * 1000; // sweep every 5 minutes

interface SessionData {
  transport: SSEServerTransport;
  server: McpServer;
  expiresAt: number;
  timeoutHandle: NodeJS.Timeout;
}

// Session Store
const sessions = new Map<string, SessionData>();

/**
 * Tears down a session: clears its timeout, closes transport + server,
 * and removes it from the map. Safe to call multiple times.
 */
function destroySession(sessionId: string, reason: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;

  sessions.delete(sessionId);
  clearTimeout(session.timeoutHandle);
  session.transport.close().catch(() => {});
  session.server.close().catch(() => {});

  logger.info({ sessionId, reason }, "MCP session destroyed");
}

/**
 * Arms (or re-arms) the hard-kill timeout for a session.
 * Uses a sliding window — each inbound POST resets the clock.
 */
function scheduleExpiry(sessionId: string): NodeJS.Timeout {
  return setTimeout(() => {
    destroySession(sessionId, "ttl_expired");
  }, SESSION_TTL_MS);
}

const reaper = setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now >= session.expiresAt) {
      destroySession(id, "reaper_sweep");
    }
  }
}, SESSION_REAP_INTERVAL_MS);

reaper.unref();

export async function sseGetHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const auth = await authorize(req, res);
  if (!auth) return;

  const server = createMcpServer(auth);
  const transport = new SSEServerTransport("/mcp/messages", res);
  const { sessionId } = transport;

  const cleanup = (): void => destroySession(sessionId, "client_disconnect");
  res.on("close", cleanup);

  try {
    await server.connect(transport);

    sessions.set(sessionId, {
      transport,
      server,
      expiresAt: Date.now() + SESSION_TTL_MS,
      timeoutHandle: scheduleExpiry(sessionId),
    });

    logger.info({ sessionId }, "MCP SSE session established");

    await transport.start();
  } catch (err) {
    logger.error(
      { err, reqId: req.id, path: req.path },
      "SSE MCP GET request failed",
    );
    cleanup();
    if (!res.headersSent) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error connecting SSE",
        },
        id: null,
      });
    }
  }
}

export async function ssePostMessageHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const sessionId = req.query["sessionId"] as string;
  if (!sessionId) {
    res.status(StatusCodes.BAD_REQUEST).send("Missing sessionId parameter");
    return;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    res.status(StatusCodes.NOT_FOUND).send("Session not found or expired");
    return;
  }

  // Sliding TTL: reset expiry on every inbound message
  clearTimeout(session.timeoutHandle);
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  session.timeoutHandle = scheduleExpiry(sessionId);

  try {
    await session.transport.handlePostMessage(req, res, req.body);
  } catch (err) {
    logger.error(
      { err, reqId: req.id, sessionId },
      "SSE MCP POST message handling failed",
    );
    if (!res.headersSent) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error handling message",
        },
        id: null,
      });
    }
  }
}
