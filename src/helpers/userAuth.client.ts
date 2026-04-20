import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";

import config from "../config/env.js";
import logger from "../config/logger.js";
import axiosInstance from "../utils/axios.instance.js";

interface UserRecord {
  id: number;
  uid: string;
  email: string;
  token: string;
  company_id: number;
  primary_company_id: number;
  account_type: string;
  role: number;
  role_char: string;
  designation: number;
  department: number;
}

export interface ResolvedAuth {
  jwtToken: string;
  signature: string;
  companyId: number;
  companyType: string;
}

export async function resolveUserAuth(email: string): Promise<ResolvedAuth> {
  const apiGatewayUrl = config.services.apiGateway;
  const serviceKey = config.oauth.mcpServiceKey;

  try {
    const res = await axiosInstance.post(
      `${apiGatewayUrl}/api/userService/internal/resolve-user-auth`,
      { email },
      {
        headers: {
          "x-service-key": serviceKey,
        },
      },
    );

    const json = res.data as { success: boolean; data: UserRecord };

    if (!json?.success) {
      logger.error(
        { status: res.status, email, body: json },
        "Failed to resolve user auth",
      );
      throw new Error(
        `[AUTH_ERROR] Could not resolve credentials for ${email}: ${res.status}`,
      );
    }

    const user = json.data;

    if (!user || !user.token) {
      throw new Error(
        `[AUTH_ERROR] User ${email} has no active session. They must log in to the web app first.`,
      );
    }

    const jwtToken = jwt.sign(
      {
        uid: user.uid || user.id,
        id: user.id,
        email: user.email,
        iss: "mcp-client",
        aud: "cms-backend",
        company_id: user.company_id,
        primary_company_id: user.primary_company_id,
        company_type: user.account_type,
        role: user.role,
        role_char: user.role_char,
      },
      config.auth.jwtSecretKey,
    );

    return {
      jwtToken,
      signature: user.token,
      companyId: user.company_id,
      companyType: user.account_type,
    };
  } catch (err: any) {
    const status = err.response?.status || StatusCodes.INTERNAL_SERVER_ERROR;
    const data = err.response?.data;

    logger.error(
      { status, email, body: data, err },
      "Failed to resolve user auth",
    );

    throw new Error(
      `[AUTH_ERROR] Could not resolve credentials for ${email}: ${status}`,
    );
  }
}
