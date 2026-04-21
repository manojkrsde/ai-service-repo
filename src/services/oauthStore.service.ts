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
    scopes: ["*"],
    revoked: false,
  });

  return {
    token: record.token,
    ...data,
  };
}

export async function getAccessToken(token: string) {
  const record = await oauthRepo.findAccessTokenByToken(token);
  if (!record || record.revoked) return undefined;

  return {
    token: record.token,
    email: record.email,
    userId: record.user_id,
    companyId: record.company_id,
    companyType: record.company_type,
    roleChar: record.role_char,
    clientId: record.client_id,
    clientNameSlug: record.client_name_slug,
  };
}

export async function revokeAccessToken(token: string) {
  await oauthRepo.markAccessTokenAsRevoked(token);
}
