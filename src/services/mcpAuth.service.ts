import type { SessionAuth } from "../mcp/auth.types.js";

/**
 * The fields from mcp_access_tokens that are needed to build a SessionAuth.
 * These are returned by getAccessToken() in oauthStore.service.ts.
 */
export interface AccessTokenSession {
  token: string;
  email: string;
  userId: number;
  companyId: number;
  companyType: string;
  roleChar: string;
  clientNameSlug: string;
  cachedJwt: string;
  cachedSignature: string;
}

/**
 * Builds a SessionAuth directly from the mcp_access_tokens record.
 *
 * Synchronous — zero DB calls, zero network calls.
 * The JWT + signature were stored at OAuth token-exchange time and are read
 * directly from the token row that was already fetched to validate the Bearer.
 */
export function buildSessionAuth(
  tokenRecord: AccessTokenSession,
  rawToken: string,
): SessionAuth {
  return {
    email: tokenRecord.email,
    userId: tokenRecord.userId,
    companyId: tokenRecord.companyId,
    companyType: tokenRecord.companyType,
    role: tokenRecord.roleChar,
    clientName: tokenRecord.clientNameSlug,
    cachedToken: tokenRecord.cachedJwt,
    cachedSignature: tokenRecord.cachedSignature,
    accessToken: rawToken,
  };
}
