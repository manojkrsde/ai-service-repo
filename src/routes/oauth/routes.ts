/**
 * OAuth 2.1 routes for MCP authentication.
 *
 * Implements the standard OAuth 2.1 + PKCE flow that MCP clients
 * (Claude Desktop, Cursor) expect:
 *
 *   /.well-known/oauth-protected-resource   → discovery
 *   /.well-known/oauth-authorization-server  → metadata
 *   /authorize                               → serves login page
 *   /callback                                → creates auth code
 *   /token                                   → exchanges code for access token
 */

import { createHash, randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

import express, { Router } from "express";
import { StatusCodes } from "http-status-codes";

import axiosInstance from "../../utils/axios.instance.js";
import config from "../../config/env.js";
import logger from "../../config/logger.js";
import { authLimiter } from "../../config/rateLimit.js";
import { slugifyClientName } from "../../helpers/slug.helper.js";
import * as oauthRepo from "../../repositories/oauth.repository.js";
import {
  createAuthCode,
  getAuthCode,
  markAuthCodeUsed,
  createAccessToken,
} from "../../services/oauthStore.service.js";
import { resolveUserAuth } from "../../helpers/api.client.js";
import { parseAxiosError } from "../../helpers/axiosError.helper.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

router.use(express.static(path.join(__dirname, "public")));

router.get("/.well-known/oauth-protected-resource", (_, res) => {
  const baseUrl = config.app.baseUrl;
  res.status(StatusCodes.OK).json({
    resource: baseUrl,
    authorization_servers: [baseUrl],
  });
});

router.get("/.well-known/oauth-authorization-server", (_, res) => {
  const baseUrl = config.app.baseUrl;
  res.status(StatusCodes.OK).json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    registration_endpoint: `${baseUrl}/register`,
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["mcp:tools"],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
  });
});

router.post("/register", async (req, res) => {
  const rawName =
    typeof req.body?.client_name === "string" && req.body.client_name.trim()
      ? req.body.client_name.trim()
      : "MCP Client";
  const slug = slugifyClientName(rawName);
  const redirectUris: string[] = Array.isArray(req.body?.redirect_uris)
    ? req.body.redirect_uris
    : [];
  const clientId = `mcp-client-${randomUUID()}`;

  try {
    await oauthRepo.insertClient({
      client_id: clientId,
      client_name: rawName,
      client_name_slug: slug,
      redirect_uris: redirectUris,
    });
  } catch (err) {
    logger.error({ err, clientId, slug }, "Failed to persist DCR client");
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: "server_error",
      error_description: "Client registration failed",
    });
    return;
  }

  res.status(StatusCodes.CREATED).json({
    client_id: clientId,
    client_name: rawName,
    redirect_uris: redirectUris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
});

router.get("/authorize", (_req, res) => {
  res
    .status(StatusCodes.OK)
    .sendFile(path.join(__dirname, "public", "authorize.html"));
});

router.post("/proxy/login", authLimiter, async (req, res) => {
  try {
    const apiGatewayUrl = config.services.apiGateway;
    const response = await axiosInstance.post(
      `${apiGatewayUrl}/api/userService/login`,
      {
        email: req.body.email,
        password: req.body.password,
      },
    );
    res.status(response.status).json(response.data);
  } catch (err: any) {
    const { status, message, errors, raw } = parseAxiosError(
      err,
      "user-service",
    );
    logger.error({ status, message, raw }, "Proxy login failed");
    res
      .status(status)
      .json({ success: false, message, ...(errors && { errors }) });
  }
});

router.post("/proxy/verify-otp", authLimiter, async (req, res) => {
  try {
    const apiGatewayUrl = config.services.apiGateway;
    const response = await axiosInstance.post(
      `${apiGatewayUrl}/api/userService/internal/verify-user-otp`,
      {
        email: req.body.email,
        otp: req.body.otp,
      },
      {
        headers: { "x-service-key": config.oauth.mcpServiceKey },
      },
    );
    res.status(response.status).json(response.data);
  } catch (err: any) {
    const { status, message, errors } = parseAxiosError(err, "user-service");
    logger.error({ status, message }, "Proxy OTP verification failed");
    res
      .status(status)
      .json({ success: false, message, ...(errors && { errors }) });
  }
});

router.post("/proxy/resend-otp", authLimiter, async (req, res) => {
  try {
    const apiGatewayUrl = config.services.apiGateway;
    const response = await axiosInstance.post(
      `${apiGatewayUrl}/api/userService/resend_otp`,
      {
        email: req.body.email,
        password: req.body.password,
      },
    );
    res.status(response.status).json(response.data);
  } catch (err: any) {
    const { status, message } = parseAxiosError(err, "user-service");
    logger.error({ status, message }, "Proxy resend OTP failed");
    res.status(status).json({ success: false, message });
  }
});

router.get("/callback", async (req, res) => {
  const {
    email,
    user_id,
    company_id,
    company_type,
    role_char,
    code_challenge,
    code_challenge_method,
    state,
    redirect_uri,
    client_id,
  } = req.query as Record<string, string>;

  if (!email || !redirect_uri || !code_challenge) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: "Missing required parameters",
    });
    return;
  }

  const record = await createAuthCode({
    email,
    userId: parseInt(user_id || "0", 10),
    companyId: parseInt(company_id || "0", 10),
    companyType: company_type || "Primary",
    roleChar: role_char || "Employee",
    clientId: client_id || "unknown",
    redirectUri: redirect_uri,
    codeChallenge: code_challenge,
    codeChallengeMethod: code_challenge_method || "S256",
  });

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", record.code);
  if (state) redirectUrl.searchParams.set("state", state);

  res.redirect(redirectUrl.toString());
});

router.post("/token", async (req, res) => {
  const { code, code_verifier, grant_type } = req.body;

  if (grant_type !== "authorization_code") {
    res
      .status(StatusCodes.BAD_REQUEST)
      .json({ error: "unsupported_grant_type" });
    return;
  }

  if (!code || !code_verifier) {
    res.status(StatusCodes.BAD_REQUEST).json({
      error: "invalid_request",
      error_description: "Missing code or code_verifier",
    });
    return;
  }

  const authCode = await getAuthCode(code);

  if (!authCode) {
    res.status(StatusCodes.BAD_REQUEST).json({
      error: "invalid_grant",
      error_description: "Invalid or expired authorization code",
    });
    return;
  }

  if (authCode.used) {
    res.status(StatusCodes.BAD_REQUEST).json({
      error: "invalid_grant",
      error_description: "Authorization code already used",
    });
    return;
  }

  if (Date.now() > authCode.expiresAt) {
    res.status(StatusCodes.BAD_REQUEST).json({
      error: "invalid_grant",
      error_description: "Authorization code expired",
    });
    return;
  }

  const computedChallenge = createHash("sha256")
    .update(code_verifier)
    .digest("base64url");

  if (computedChallenge !== authCode.codeChallenge) {
    res.status(StatusCodes.BAD_REQUEST).json({
      error: "invalid_grant",
      error_description: "PKCE verification failed",
    });
    return;
  }

  await markAuthCodeUsed(code);

  const client = await oauthRepo.findClientById(authCode.clientId);
  const clientNameSlug = client?.client_name_slug ?? "mcp-client";

  /**
   * Resolve backend credentials from user-services.
   *
   * resolveUserAuth is called EXACTLY ONCE per login — here, during the
   * OAuth code exchange. The resulting JWT + signature are stored directly
   * in mcp_access_tokens and served on every subsequent MCP request from
   * that row alone. No backend auth calls happen during normal operation.
   *
   * On a backend 401 the token is revoked, getAccessToken() returns undefined,
   * and Claude receives HTTP 401 + WWW-Authenticate → re-opens login page.
   */
  let cachedJwt: string;
  let cachedSignature: string;
  try {
    const resolved = await resolveUserAuth({
      email: authCode.email,
      clientName: clientNameSlug,
    });
    cachedJwt = resolved.jwtToken;
    cachedSignature = resolved.signature;
  } catch (authErr) {
    logger.error(
      { err: authErr, email: authCode.email },
      "Failed to resolve backend credentials during token exchange",
    );
    res.status(StatusCodes.BAD_GATEWAY).json({
      error: "server_error",
      error_description:
        "Could not resolve backend credentials. Please try logging in again.",
    });
    return;
  }

  const tokenRecord = await createAccessToken({
    email: authCode.email,
    userId: authCode.userId,
    companyId: authCode.companyId,
    companyType: authCode.companyType,
    roleChar: authCode.roleChar,
    clientId: authCode.clientId,
    clientNameSlug,
    cachedJwt,
    cachedSignature,
  });

  logger.info(
    { email: authCode.email, clientNameSlug },
    "MCP access token issued with backend credentials",
  );

  res.status(StatusCodes.OK).json({
    access_token: tokenRecord.token,
    token_type: "Bearer",
    scope: "mcp:tools",
  });
});

export default router;
