import { createHmac } from "crypto";

export interface JwtPayload {
  id: number;
  uid: number;
  email: string;
  company_id: number;
  company_type: string;
  role_char: string;
  exp?: number;
  [key: string]: unknown;
}

function base64urlDecode(str: string): string {
  return Buffer.from(
    str.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString("utf8");
}

export function verifyJwt(token: string, secret: string): JwtPayload {
  const parts = token.split(".");
  const encodedHeader = parts[0];
  const encodedPayload = parts[1];
  const signature = parts[2];

  if (parts.length !== 3 || !encodedHeader || !encodedPayload || !signature) {
    throw new Error("Invalid JWT: must have three dot-separated parts");
  }

  const expectedSig = createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest("base64url");

  if (signature !== expectedSig) {
    throw new Error("Invalid JWT: signature mismatch");
  }

  const rawPayload: unknown = JSON.parse(base64urlDecode(encodedPayload));
  if (typeof rawPayload !== "object" || rawPayload === null) {
    throw new Error("Invalid JWT: payload is not an object");
  }

  const payload = rawPayload as JwtPayload;

  if (payload.exp !== undefined && Date.now() / 1000 > payload.exp) {
    throw new Error("JWT expired");
  }

  return payload;
}
