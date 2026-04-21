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

interface ResolveUserAuthResponse {
  success: boolean;
  data: {
    jwt_token: string;
    signature: string;
    user: UserRecord;
  };
}

export interface ResolvedAuth {
  jwtToken: string;
  signature: string;
  companyId: number;
  companyType: string;
}

export interface ResolveUserAuthArgs {
  email: string;
  clientName: string;
}

export async function resolveUserAuth({
  email,
  clientName,
}: ResolveUserAuthArgs): Promise<ResolvedAuth> {
  const apiGatewayUrl = config.services.apiGateway;
  const serviceKey = config.oauth.mcpServiceKey;

  try {
    const res = await axiosInstance.post(
      `${apiGatewayUrl}/api/userService/internal/resolve-user-auth`,
      { email, client_name: clientName },
      {
        headers: {
          "x-service-key": serviceKey,
        },
      },
    );

    const json = res.data as ResolveUserAuthResponse;

    if (!json?.success || !json?.data?.jwt_token || !json?.data?.signature) {
      logger.error(
        { status: res.status, email, clientName, body: json },
        "Failed to resolve user auth",
      );
      throw new Error(
        `[AUTH_ERROR] Could not resolve credentials for ${email}: ${res.status}`,
      );
    }

    const { jwt_token, signature, user } = json.data;

    return {
      jwtToken: jwt_token,
      signature,
      companyId: user.company_id,
      companyType: user.account_type,
    };
  } catch (err: any) {
    const status = err.response?.status || StatusCodes.INTERNAL_SERVER_ERROR;
    const data = err.response?.data;

    logger.error(
      { status, email, clientName, body: data, err },
      "Failed to resolve user auth",
    );

    throw new Error(
      `[AUTH_ERROR] Could not resolve credentials for ${email}: ${status}`,
    );
  }
}
