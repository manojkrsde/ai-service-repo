import { randomUUID } from "crypto";

import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

import logger from "../../config/logger.js";
import { createMcpServer } from "../server.js";
import { streamableSessionStore } from "../session-store.js";

export async function streamablePostHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // ── Existing session
  if (sessionId !== undefined) {
    const session = streamableSessionStore.get(sessionId);

    if (session === undefined) {
      logger.warn({ sessionId }, "Streamable MCP message for unknown session");
      res.status(404).json({
        success: false,
        message: `No active streamable session for id: ${sessionId}`,
      });
      return;
    }

    logger.debug({ sessionId }, "Streamable MCP message received");
    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  // ── New session
  if (!isInitializeRequest(req.body)) {
    res.status(400).json({
      success: false,
      message:
        "First request on a new streamable session must be an InitializeRequest",
    });
    return;
  }

  const server = createMcpServer();

  // `const` is safe here — onsessioninitialized fires after this assignment,
  // so the closure always captures the fully constructed transport reference.
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (newSessionId) => {
      streamableSessionStore.set(newSessionId, { transport, server });
      logger.info(
        { sessionId: newSessionId },
        "Streamable MCP session created",
      );
    },
  });

  // Set onclose before connect so it is always defined when the SDK reads it.
  // Cast to Transport is required: SDK types onclose as `(() => void) | undefined`
  // on the concrete class, which conflicts with the `() => void` on the Transport
  // interface under exactOptionalPropertyTypes. This is an SDK-side type gap.
  transport.onclose = (): void => {
    const sid = transport.sessionId;
    if (sid !== undefined) {
      streamableSessionStore.delete(sid);
      logger.info(
        { sessionId: sid },
        "Streamable MCP transport closed — session removed",
      );
    }
  };

  await server.connect(transport as unknown as Transport);
  await transport.handleRequest(req, res, req.body);
}

export async function streamableGetHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId === undefined) {
    res.status(400).json({
      success: false,
      message: "Missing required header: mcp-session-id",
    });
    return;
  }

  const session = streamableSessionStore.get(sessionId);

  if (session === undefined) {
    logger.warn(
      { sessionId },
      "Streamable MCP SSE request for unknown session",
    );
    res.status(404).json({
      success: false,
      message: `No active streamable session for id: ${sessionId}`,
    });
    return;
  }

  logger.info({ sessionId }, "Streamable MCP SSE stream opened");
  await session.transport.handleRequest(req, res);
}

export async function streamableDeleteHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId === undefined) {
    res.status(400).json({
      success: false,
      message: "Missing required header: mcp-session-id",
    });
    return;
  }

  const session = streamableSessionStore.get(sessionId);

  if (session === undefined) {
    logger.warn({ sessionId }, "Streamable MCP DELETE for unknown session");
    res.status(404).json({
      success: false,
      message: `No active streamable session for id: ${sessionId}`,
    });
    return;
  }

  await session.server.close();
  streamableSessionStore.delete(sessionId);

  logger.info({ sessionId }, "Streamable MCP session explicitly terminated");
  res.status(200).json({ success: true, message: "Session terminated" });
}
