import { createHash } from "crypto";

import logger from "../config/logger.js";
import { resolveUserAuth } from "../helpers/userAuth.client.js";
import type { SessionAuth } from "../mcp/auth.types.js";
import * as cacheRepo from "../repositories/mcpAuthCache.repository.js";

const TTL_MS = 5 * 60 * 1000;

interface TokenRecord {
  token: string;
  email: string;
  userId: number;
  companyId: number;
  companyType: string;
  roleChar: string;
  clientId: string;
  clientNameSlug: string;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function resolveSessionAuth(
  tokenRecord: TokenRecord,
): Promise<SessionAuth> {
  const tokenHash = hashToken(tokenRecord.token);

  const cached = await cacheRepo.getByTokenHash(tokenHash).catch((err) => {
    logger.warn(
      { err },
      "mcpAuthCache lookup failed; falling through to backend",
    );
    return null;
  });

  if (cached) {
    return {
      email: cached.email,
      userId: cached.user_id,
      companyId: cached.company_id,
      companyType: cached.company_type,
      role: cached.role_char,
      clientName: tokenRecord.clientNameSlug,
      cachedToken: cached.cached_jwt,
      cachedSignature: cached.cached_signature,
    };
  }

  const resolved = await resolveUserAuth({
    email: tokenRecord.email,
    clientName: tokenRecord.clientNameSlug,
  });

  const auth: SessionAuth = {
    email: tokenRecord.email,
    userId: tokenRecord.userId,
    companyId: tokenRecord.companyId,
    companyType: tokenRecord.companyType,
    role: tokenRecord.roleChar,
    clientName: tokenRecord.clientNameSlug,
    cachedToken: resolved.jwtToken,
    cachedSignature: resolved.signature,
  };

  const expiresAt = new Date(Date.now() + TTL_MS);

  cacheRepo
    .upsertAuth({
      token_hash: tokenHash,
      email: auth.email,
      user_id: auth.userId,
      company_id: auth.companyId,
      company_type: auth.companyType,
      role_char: auth.role,
      cached_jwt: auth.cachedToken,
      cached_signature: auth.cachedSignature,
      expires_at: expiresAt,
    })
    .catch((err) => {
      logger.warn({ err }, "mcpAuthCache upsert failed (non-fatal)");
    });

  cacheRepo.deleteExpired().catch(() => {});

  return auth;
}
