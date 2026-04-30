import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface CompanySettings {
  company_id: string | null;
  company_type: string | null;
  settings: any;
  created_at: string | null;
  updated_at: string | null;
}

interface SettingsRecord {
  companyId?: string | null;
  companyType?: string | null;
  settings?: any;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface CompanySettingsResponse {
  data: {
    data: SettingsRecord | null;
  };
}

export const getCompanySettingsTool: ToolDefinition<
  typeof schema,
  CompanySettings
> = {
  name: "get_company_settings",
  title: "Get company configuration — biometric, policy & feature settings",
  description:
    "Returns the configured settings document for the caller's company (e.g. biometric attendance " +
    "toggle, feature flags, policy switches). The settings shape is intentionally open-ended — " +
    "fields may evolve over time as new toggles are added. " +
    "\n\nUSE THIS TOOL TO: check whether a specific feature is enabled (e.g. biometricEnabled), " +
    "verify a company's configured policies before answering policy-related questions, or " +
    "diagnose why a behaviour differs across tenants. " +
    "\n\nNOTE: Returns null `settings` if no settings record exists yet for this company. The " +
    "endpoint never includes other tenants' configs — strictly company-scoped.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["company", "settings", "configuration"] },

  handler: async (_input, ctx) => {
    const auth = ctx.sessionAuth;
    if (!auth) {
      throw new Error(
        "[AUTH_ERROR] Session credentials not available. Please re-initialize the MCP session.",
      );
    }

    const res = await apiPost<CompanySettingsResponse>(
      `${SERVICE.USERS}/getCompanySettings`,
      {
        c_id: String(auth.companyId),
        c_type: auth.companyType,
      },
      ctx,
      { injectCompanyContext: false },
    );

    const r = res?.data?.data ?? null;
    return {
      company_id: r?.companyId ?? null,
      company_type: r?.companyType ?? null,
      settings: r?.settings ?? null,
      created_at: r?.createdAt ?? null,
      updated_at: r?.updatedAt ?? null,
    };
  },
};

toolRegistry.register(getCompanySettingsTool);
