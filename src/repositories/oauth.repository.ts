import { McpAuthCodes, McpAccessTokens } from "../models/index.js";

export async function insertAuthCode(data: any) {
  return await McpAuthCodes.create(data);
}

export async function findAuthCodeByCode(code: string) {
  return await McpAuthCodes.findOne({ where: { code } });
}

export async function markAuthCodeAsUsed(code: string) {
  await McpAuthCodes.update({ used: true }, { where: { code } });
}

export async function insertAccessToken(data: any) {
  return await McpAccessTokens.create(data);
}

export async function findAccessTokenByToken(token: string) {
  return await McpAccessTokens.findOne({ where: { token } });
}

export async function markAccessTokenAsRevoked(token: string) {
  await McpAccessTokens.update({ revoked: true }, { where: { token } });
}
