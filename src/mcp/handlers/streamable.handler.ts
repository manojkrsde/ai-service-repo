import { randomUUID } from "crypto";

import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { StatusCodes } from "http-status-codes";

import config from "../../config/env.js";
import logger from "../../config/logger.js";
import { getAccessToken } from "../../services/oauthStore.service.js";
import { resolveUserAuth } from "../../helpers/userAuth.client.js";
import { createMcpServer } from "../server.js";
import { streamableSessionStore, type SessionAuth } from "../session-store.js";

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
      res.status(StatusCodes.NOT_FOUND).json({
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
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message:
        "First request on a new streamable session must be an InitializeRequest",
    });
    return;
  }

  // Extract access token from Authorization header
  const rawToken = (req.headers["authorization"] as string | undefined)
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!rawToken) {
    const baseUrl = config.app.baseUrl.replace(/\/+$/, "");
    res
      .status(StatusCodes.UNAUTHORIZED)
      .header(
        "WWW-Authenticate",
        `Bearer realm="MCP Server", resource_metadata_uri="${baseUrl}/.well-known/oauth-protected-resource"`,
      )
      .json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Missing Bearer token" },
        id: null,
      });
    return;
  }

  // Look up the access token in the OAuth store
  const tokenRecord = await getAccessToken(rawToken);

  if (!tokenRecord) {
    res.status(StatusCodes.FORBIDDEN).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Invalid or expired access token" },
      id: null,
    });
    return;
  }

  // Resolve the user's current backend credentials
  let auth: SessionAuth;
  try {
    const resolved = await resolveUserAuth(tokenRecord.email);
    auth = {
      email: tokenRecord.email,
      userId: tokenRecord.userId,
      companyId: tokenRecord.companyId,
      companyType: tokenRecord.companyType,
      role: tokenRecord.roleChar,
      cachedToken: resolved.jwtToken,
      cachedSignature: resolved.signature,
    };
  } catch (err) {
    logger.error(
      { err, email: tokenRecord.email },
      "Failed to resolve user auth on session init",
    );
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message:
        "Could not resolve backend credentials. User may need to log in to the web app.",
    });
    return;
  }

  const server = createMcpServer(auth);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (newSessionId) => {
      streamableSessionStore.set(newSessionId, { transport, server, auth });
      logger.info(
        { sessionId: newSessionId, userId: auth.userId, email: auth.email },
        "Streamable MCP session created",
      );
    },
  });

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
    res.status(StatusCodes.BAD_REQUEST).json({
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
    res.status(StatusCodes.NOT_FOUND).json({
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
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Missing required header: mcp-session-id",
    });
    return;
  }

  const session = streamableSessionStore.get(sessionId);

  if (session === undefined) {
    logger.warn({ sessionId }, "Streamable MCP DELETE for unknown session");
    res.status(StatusCodes.NOT_FOUND).json({
      success: false,
      message: `No active streamable session for id: ${sessionId}`,
    });
    return;
  }

  await session.server.close();
  streamableSessionStore.delete(sessionId);

  logger.info({ sessionId }, "Streamable MCP session explicitly terminated");
  res
    .status(StatusCodes.OK)
    .json({ success: true, message: "Session terminated" });
}
