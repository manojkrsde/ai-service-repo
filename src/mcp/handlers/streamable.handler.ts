import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StatusCodes } from "http-status-codes";

import config from "../../config/env.js";
import logger from "../../config/logger.js";
import { getAccessToken } from "../../services/oauthStore.service.js";
import {
  buildSessionAuth,
  type AccessTokenSession,
} from "../../services/mcpAuth.service.js";
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
      error: { code: -32000, message: "Missing or invalid Bearer token" },
      id: null,
    });
}

/**
 * Validates the Bearer token and builds a SessionAuth.
 *
 * Returns null (and has already written a 401 response) if:
 *  - No Bearer token in the Authorization header
 *  - Token is unknown, revoked, or missing credentials (pre-migration row)
 */
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
    // HTTP 401 + WWW-Authenticate signals Claude to re-open the login page.
    unauthorized(res);
    return null;
  }

  return buildSessionAuth(tokenRecord as AccessTokenSession, rawToken);
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
