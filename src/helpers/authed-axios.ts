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

/**
 * POST to a backend service with automatic auth and 401-retry.
 */
export async function authedPost<T>(
  url: string,
  body: Record<string, unknown>,
  auth: SessionAuth,
): Promise<T> {
  try {
    const res = await doPost(
      url,
      body,
      auth.cachedToken,
      auth.cachedSignature,
      auth.companyId,
      auth.companyType,
    );
    return res.data as T;
  } catch (err: unknown) {
    if (isAxios401(err)) {
      logger.info(
        { email: auth.email },
        "401 from backend — refreshing user credentials",
      );

      try {
        const fresh = await resolveUserAuth(auth.email);

        auth.cachedToken = fresh.jwtToken;
        auth.cachedSignature = fresh.signature;

        const retryRes = await doPost(
          url,
          body,
          fresh.jwtToken,
          fresh.signature,
          fresh.companyId,
          fresh.companyType,
        );
        return retryRes.data as T;
      } catch (retryErr: unknown) {
        if (isAxios401(retryErr)) {
          throw new Error(
            "[AUTH_ERROR] User session expired even after refresh. " +
              "Please re-initialize MCP session.",
          );
        }

        if (
          retryErr instanceof Error &&
          retryErr.message.startsWith("[AUTH_ERROR]")
        ) {
          throw retryErr;
        }

        logger.error(
          { err: retryErr, email: auth.email },
          "Failed to refresh credentials",
        );
        throw new Error(
          "[AUTH_ERROR] Could not refresh credentials. Please re-initialize MCP session.",
        );
      }
    }

    if (isAxios403(err)) {
      const parsed = parseAxiosError(err, url);
      throw new Error(`[PERMISSION_DENIED] ${parsed.message}`);
    }

    const parsed = parseAxiosError(err, url);
    throw new Error(`Backend returned HTTP ${parsed.status}: ${parsed.message}`);
  }
}

async function doPost(
  url: string,
  body: Record<string, unknown>,
  token: string,
  signature: string,
  companyId: number,
  companyType: string,
) {
  return axiosInstance.post(url, {
    ...body,
    signature,
    company_id: companyId,
    company_type: companyType,
  }, {
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
