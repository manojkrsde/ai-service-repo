import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StatusCodes } from "http-status-codes";

import config from "../../config/env.js";
import logger from "../../config/logger.js";
import { getAccessToken } from "../../services/oauthStore.service.js";
import { resolveSessionAuth } from "../../services/mcpAuth.service.js";
import { createMcpServer } from "../server.js";

function unauthorized(res: Response): void {
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
}

async function authorize(req: Request, res: Response) {
  const rawToken = (req.headers["authorization"] as string | undefined)
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!rawToken) {
    unauthorized(res);
    return null;
  }

  const tokenRecord = await getAccessToken(rawToken);

  if (!tokenRecord) {
    res.status(StatusCodes.FORBIDDEN).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Invalid or expired access token" },
      id: null,
    });
    return null;
  }

  try {
    return await resolveSessionAuth(tokenRecord);
  } catch (err) {
    logger.error(
      { err, email: tokenRecord.email },
      "Failed to resolve user auth",
    );
    res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message:
        "Could not resolve backend credentials. User may need to log in to the web app.",
    });
    return null;
  }
}

async function handleStateless(req: Request, res: Response): Promise<void> {
  const auth = await authorize(req, res);
  if (!auth) return;

  const server = createMcpServer(auth);
  // Stateless mode: omit sessionIdGenerator so the SDK issues no session ID
  // and skips session validation. Safe for Vercel serverless because every
  // request builds its own transport+server.
  const transport = new StreamableHTTPServerTransport({});

  const cleanup = (): void => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  };
  res.on("close", cleanup);

  try {
    await server.connect(transport as unknown as Transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    logger.error(
      { err, reqId: req.id, path: req.path },
      "Streamable MCP request failed",
    );
    if (!res.headersSent) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}

export async function streamablePostHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await handleStateless(req, res);
}

export async function streamableGetHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await handleStateless(req, res);
}

export async function streamableDeleteHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await handleStateless(req, res);
}
