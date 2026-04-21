/**
 * Authenticated HTTP client for backend service calls.
 *
 * Wraps axiosInstance with:
 * 1. Auto-injection of JWT + signature from SessionAuth
 * 2. 401-retry: if backend rejects (stale signature), re-fetches
 *    fresh credentials from user-services and retries once.
 */
import { AxiosError } from "axios";

import logger from "../config/logger.js";
import type { SessionAuth } from "../mcp/auth.types.js";
import axiosInstance from "../utils/axios.instance.js";
import { parseAxiosError } from "./axiosError.helper.js";
import { resolveUserAuth } from "./userAuth.client.js";
import type { ResolvedAuth } from "./userAuth.client.js";

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
 * POST to a backend service with automatic auth and 401-retry.
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
    if (!isAxios401(err)) {
      throwBackendError(err, url);
    }

    logger.info(
      { email: auth.email },
      "401 from backend — refreshing user credentials",
    );

    let fresh: ResolvedAuth;
    try {
      fresh = await resolveUserAuth({
        email: auth.email,
        clientName: auth.clientName,
      });
      auth.cachedToken = fresh.jwtToken;
      auth.cachedSignature = fresh.signature;
    } catch (refreshErr: unknown) {
      if (
        refreshErr instanceof Error &&
        refreshErr.message.startsWith("[AUTH_ERROR]")
      ) {
        throw refreshErr;
      }
      logger.error(
        { err: refreshErr, email: auth.email },
        "Failed to refresh credentials",
      );
      throw new Error(
        "[AUTH_ERROR] Could not refresh credentials. Please re-initialize MCP session.",
      );
    }

    try {
      const retryRes = await doPost(
        url,
        body,
        fresh.jwtToken,
        fresh.signature,
        fresh.companyId,
        fresh.companyType,
        injectCompany,
      );
      return retryRes.data as T;
    } catch (retryErr: unknown) {
      if (isAxios401(retryErr)) {
        throw new Error(
          "[AUTH_ERROR] User session expired even after refresh. " +
            "Please re-initialize MCP session.",
        );
      }
      throwBackendError(retryErr, url);
    }
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
