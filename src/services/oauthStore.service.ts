import { randomBytes } from "crypto";
import * as oauthRepo from "../repositories/oauth.repository.js";

export interface AuthCodeData {
  email: string;
  userId: number;
  companyId: number;
  companyType: string;
  roleChar: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
}

export interface AccessTokenData {
  email: string;
  userId: number;
  companyId: number;
  companyType: string;
  roleChar: string;
  clientId: string;
  clientNameSlug: string;
  /** Backend JWT obtained from user-services at OAuth token-exchange time. */
  cachedJwt: string;
  /** Backend signature obtained from user-services at OAuth token-exchange time. */
  cachedSignature: string;
}

export async function createAuthCode(data: AuthCodeData) {
  const code = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const record = await oauthRepo.insertAuthCode({
    code,
    email: data.email,
    user_id: data.userId,
    company_id: data.companyId,
    company_type: data.companyType,
    role_char: data.roleChar,
    client_id: data.clientId,
    redirect_uri: data.redirectUri,
    code_challenge: data.codeChallenge,
    code_challenge_method: data.codeChallengeMethod,
    expires_at: expiresAt,
    used: false,
  });

  return {
    code: record.code,
    ...data,
  };
}

export async function getAuthCode(code: string) {
  const record = await oauthRepo.findAuthCodeByCode(code);
  if (!record) return undefined;

  return {
    code: record.code,
    email: record.email,
    userId: record.user_id,
    companyId: record.company_id,
    companyType: record.company_type,
    roleChar: record.role_char,
    clientId: record.client_id,
    redirectUri: record.redirect_uri,
    codeChallenge: record.code_challenge,
    codeChallengeMethod: record.code_challenge_method,
    expiresAt: new Date(record.expires_at).getTime(),
    used: record.used,
    isExpired: record.isExpired(),
    isValid: record.isValid(),
  };
}

export async function markAuthCodeUsed(code: string) {
  await oauthRepo.markAuthCodeAsUsed(code);
}

export async function createAccessToken(data: AccessTokenData) {
  const token = randomBytes(48).toString("hex");

  const record = await oauthRepo.insertAccessToken({
    token,
    email: data.email,
    user_id: data.userId,
    company_id: data.companyId,
    company_type: data.companyType,
    role_char: data.roleChar,
    client_id: data.clientId,
    client_name_slug: data.clientNameSlug,
    cached_jwt: data.cachedJwt,
    cached_signature: data.cachedSignature,
    scopes: ["*"],
    revoked: false,
  });

  return {
    token: record.token,
    ...data,
  };
}

/**
 * Looks up a valid (non-revoked) MCP access token.
 *
 * Returns undefined if the token is unknown, revoked, or is missing
 * backend credentials (pre-migration rows). In all three cases the
 * streamable handler will return HTTP 401 + WWW-Authenticate so Claude
 * re-opens the login page.
 */
export async function getAccessToken(token: string) {
  const record = await oauthRepo.findAccessTokenByToken(token);

  if (!record || record.revoked) return undefined;

  if (!record.cached_jwt || !record.cached_signature) return undefined;

  return {
    token: record.token,
    email: record.email,
    userId: record.user_id,
    companyId: record.company_id,
    companyType: record.company_type,
    roleChar: record.role_char,
    clientId: record.client_id,
    clientNameSlug: record.client_name_slug,
    cachedJwt: record.cached_jwt,
    cachedSignature: record.cached_signature,
  };
}

export async function revokeAccessToken(token: string) {
  await oauthRepo.markAccessTokenAsRevoked(token);
}
