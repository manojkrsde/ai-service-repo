/**
 * Thin HTTP client for the attendance microservice.
 *
 * Uses authedPost for automatic auth injection and 401-retry.
 */
import config from "../config/env.js";
import { authedPost } from "./authed-axios.js";
import type { AuthedPostOptions } from "./authed-axios.js";
import type { ToolContext } from "../types/tool.types.js";

const PATH_PREFIX = "/api/attendanceService";

/**
 * POST to an attendance-service endpoint.
 * Auth credentials are automatically injected from the session.
 */
export async function attendancePost<T>(
  endpoint: string,
  body: Record<string, unknown>,
  ctx: ToolContext,
  options?: AuthedPostOptions,
): Promise<T> {
  if (!ctx.sessionAuth) {
    throw new Error(
      "[AUTH_ERROR] Session credentials not available. Please re-initialize the MCP session.",
    );
  }

  const url = `${config.services.apiGateway}${PATH_PREFIX}${endpoint}`;
  return authedPost<T>(url, body, ctx.sessionAuth, options);
}
