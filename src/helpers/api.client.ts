/**
 * Unified HTTP client for the API gateway.
 *
 * - `apiPost`        → authed user calls (JWT + signature via SessionAuth).
 * - `apiServicePost` → service-to-service calls (x-service-key).
 * - `resolveUserAuth` → OAuth login helper built on `apiServicePost`.
 *
 * All outbound calls share the same axios instance, base URL, and
 * path prefixes exposed via the `SERVICE` constant.
 */
import { StatusCodes } from "http-status-codes";

import config from "../config/env.js";
import logger from "../config/logger.js";
import axiosInstance from "../utils/axios.instance.js";
import { authedPost, type AuthedPostOptions } from "./authed-axios.js";
import type { ToolContext } from "../types/tool.types.js";

export const SERVICE = {
  LEADS: "/api/leadService",
  USERS: "/api/userService",
  ATTENDANCE: "/api/attendanceService",
  CALL_LOGS: "/api/callLogsService",
  TODO: "/api/todoService",
  ERS: "/api/ers",
  ASSETS: "/api/assetService",
  ACTIVITY_CALENDAR: "/api/activityCalendarService",
  TASK: "/api/taskService",
  TICKETS: "/api/raiseTicketsService",
  AUTOMATIONS: "/api/automationsService",
  DRIVE: "/api/driveService",
} as const;

/**
 * POST to an API-gateway endpoint with the user's session auth.
 * Caller passes the full path, e.g. `${SERVICE.LEADS}/getLeadsList`.
 */
export async function apiPost<T>(
  path: string,
  body: Record<string, unknown>,
  ctx: ToolContext,
  options?: AuthedPostOptions,
): Promise<T> {
  if (!ctx.sessionAuth) {
    throw new Error(
      "[AUTH_ERROR] Session credentials not available. Please re-initialize the MCP session.",
    );
  }

  const url = `${config.services.apiGateway}${path}`;
  return authedPost<T>(url, body, ctx.sessionAuth, options);
}

/**
 * POST to an API-gateway endpoint using the MCP service key.
 * Used for internal, pre-session calls (e.g. OAuth login).
 */
export async function apiServicePost<T>(
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = `${config.services.apiGateway}${path}`;
  const serviceKey = config.oauth.mcpServiceKey;

  try {
    const res = await axiosInstance.post(url, body, {
      headers: { "x-service-key": serviceKey },
    });
    return res.data as T;
  } catch (err: unknown) {
    const axiosErr = err as {
      response?: { status?: number; data?: unknown };
    };
    const status =
      axiosErr.response?.status ?? StatusCodes.INTERNAL_SERVER_ERROR;
    logger.error(
      { status, path, body: axiosErr.response?.data, err },
      "Service-to-service POST failed",
    );
    throw new Error(`[SERVICE_ERROR] ${path} failed: ${status}`);
  }
}

interface UserRecord {
  id: number;
  uid: string;
  email: string;
  token: string;
  company_id: number;
  primary_company_id: number;
  account_type: string;
  role: number;
  role_char: string;
  designation: number;
  department: number;
}

interface ResolveUserAuthResponse {
  success: boolean;
  data: {
    jwt_token: string;
    signature: string;
    user: UserRecord;
  };
}

export interface ResolvedAuth {
  jwtToken: string;
  signature: string;
  companyId: number;
  companyType: string;
}

export interface ResolveUserAuthArgs {
  email: string;
  clientName: string;
}

export async function resolveUserAuth({
  email,
  clientName,
}: ResolveUserAuthArgs): Promise<ResolvedAuth> {
  let json: ResolveUserAuthResponse;
  try {
    json = await apiServicePost<ResolveUserAuthResponse>(
      "/api/userService/internal/resolve-user-auth",
      { email, client_name: clientName },
    );
  } catch (err) {
    logger.error({ email, clientName, err }, "Failed to resolve user auth");
    throw new Error(`[AUTH_ERROR] Could not resolve credentials for ${email}`);
  }

  if (!json?.success || !json?.data?.jwt_token || !json?.data?.signature) {
    logger.error(
      { email, clientName, body: json },
      "Failed to resolve user auth",
    );
    throw new Error(`[AUTH_ERROR] Could not resolve credentials for ${email}`);
  }

  const { jwt_token, signature, user } = json.data;

  return {
    jwtToken: jwt_token,
    signature,
    companyId: user.company_id,
    companyType: user.account_type,
  };
}
