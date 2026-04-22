/**
 * Authenticated HTTP client for backend service calls.
 *
 * Wraps axiosInstance with auto-injection of JWT + signature from SessionAuth.
 *
 * On a 401 from the backend the session is no longer valid. The correct
 * behaviour is NOT to silently regenerate a token — instead:
 *   1. Revoke the MCP access token (revoked=true in mcp_access_tokens)
 *      → the next Claude request gets HTTP 401 + WWW-Authenticate
 *   2. Throw [AUTH_REQUIRED] so the current tool call fails with a clear msg
 *
 * Claude will then re-open the MCP login page and a fresh token + credentials
 * will be stored in mcp_access_tokens on the next /token exchange.
 */
import { AxiosError } from "axios";

import logger from "../config/logger.js";
import type { SessionAuth } from "../mcp/auth.types.js";
import { revokeAccessToken } from "../services/oauthStore.service.js";
import axiosInstance from "../utils/axios.instance.js";
import { parseAxiosError } from "./axiosError.helper.js";

export interface AuthedPostOptions {
  /**
   * Auto-inject `company_id` / `company_type` into the body. Default true.
   *
   * Some backend endpoints use strict Joi schemas with different key names
   * (e.g. `c_id`, `c_type`) and reject the injected keys as unknown. Those
   * callers should disable injection and set the tenant keys themselves.
   */
  injectCompanyContext?: boolean;
}

/**
 * POST to a backend service with automatic auth header injection.
 *
 * Throws `[AUTH_REQUIRED]` (and revokes the MCP token) if the backend
 * returns 401. All other errors are rethrown as-is.
 */
export async function authedPost<T>(
  url: string,
  body: Record<string, unknown>,
  auth: SessionAuth,
  options: AuthedPostOptions = {},
): Promise<T> {
  const injectCompany = options.injectCompanyContext ?? true;

  try {
    const res = await doPost(
      url,
      body,
      auth.cachedToken,
      auth.cachedSignature,
      auth.companyId,
      auth.companyType,
      injectCompany,
    );
    return res.data as T;
  } catch (err: unknown) {
    if (isAxios401(err)) {
      logger.warn(
        { email: auth.email, url },
        "401 from backend — revoking MCP token and forcing re-authentication",
      );
      revokeAccessToken(auth.accessToken).catch((revokeErr) => {
        logger.warn(
          { revokeErr, email: auth.email },
          "Failed to revoke MCP access token (non-fatal)",
        );
      });

      throw new Error(
        "[AUTH_REQUIRED] Backend session expired or was revoked. " +
          "Please re-authenticate via the MCP login page.",
      );
    }

    throwBackendError(err, url);
  }
}

function throwBackendError(err: unknown, url: string): never {
  if (isAxios403(err)) {
    const parsed = parseAxiosError(err, url);
    throw new Error(`[PERMISSION_DENIED] ${parsed.message}`);
  }

  const parsed = parseAxiosError(err, url);
  throw new Error(`Backend returned HTTP ${parsed.status}: ${parsed.message}`);
}

async function doPost(
  url: string,
  body: Record<string, unknown>,
  token: string,
  signature: string,
  companyId: number,
  companyType: string,
  injectCompany: boolean,
) {
  const requestBody: Record<string, unknown> = { ...body, signature };
  if (injectCompany) {
    requestBody["company_id"] = companyId;
    requestBody["company_type"] = companyType;
  }

  return axiosInstance.post(url, requestBody, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

function isAxios401(err: unknown): boolean {
  return err instanceof AxiosError && err.response?.status === 401;
}

function isAxios403(err: unknown): boolean {
  return err instanceof AxiosError && err.response?.status === 403;
}
