import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import config from "../../config/env.js";
import { getAccessToken } from "../../services/oauthStore.service.js";
import {
  buildSessionAuth,
  type AccessTokenSession,
} from "../../services/mcpAuth.service.js";

export function unauthorized(res: Response): void {
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
export async function authorize(req: Request, res: Response) {
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
