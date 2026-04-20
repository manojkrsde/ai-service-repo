import { Op } from "sequelize";

import { McpAuthCache } from "../models/index.js";

export interface CachedAuthRow {
  token_hash: string;
  email: string;
  user_id: number;
  company_id: number;
  company_type: string;
  role_char: string;
  cached_jwt: string;
  cached_signature: string;
  expires_at: Date;
}

export async function getByTokenHash(
  tokenHash: string,
): Promise<CachedAuthRow | null> {
  const record = await McpAuthCache.findOne({
    where: { token_hash: tokenHash },
  });
  if (!record) return null;
  if (record.isExpired()) return null;
  return record.get({ plain: true }) as CachedAuthRow;
}

export async function upsertAuth(row: CachedAuthRow): Promise<void> {
  await McpAuthCache.upsert(row as unknown as Record<string, unknown>);
}

export async function deleteExpired(): Promise<void> {
  await McpAuthCache.destroy({
    where: { expires_at: { [Op.lt]: new Date() } },
  });
}
