/**
 * Thin HTTP client for the lead microservice.
 *
 * Uses authedPost for automatic auth injection and 401-retry.
 * The SessionAuth's cached credentials are used for each call,
 * and automatically refreshed if the user's session token has changed.
 */
import config from "../config/env.js";
import { authedPost } from "./authed-axios.js";
import type { ToolContext } from "../types/tool.types.js";

const PATH_PREFIX = "/api/leadService";

/**
 * POST to a lead-service endpoint.
 * Auth credentials are automatically injected from the session.
 */
export async function leadsPost<T>(
  endpoint: string,
  body: Record<string, unknown>,
  ctx: ToolContext,
): Promise<T> {
  if (!ctx.sessionAuth) {
    throw new Error(
      "[AUTH_ERROR] Session credentials not available. Please re-initialize the MCP session.",
    );
  }

  const url = `${config.services.apiGateway}${PATH_PREFIX}${endpoint}`;
  return authedPost<T>(url, body, ctx.sessionAuth);
}
