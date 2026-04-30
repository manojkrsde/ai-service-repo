import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface ChildCompany {
  id: number;
  name: string;
  email: string;
  phone: string;
  location: string | null;
  status: string;
  created_at: string | null;
  address1: string | null;
  address2: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  pincode: string | null;
  logo_url: string | null;
}

interface ChildCompanyRecord {
  key?: number;
  Company_Name?: string;
  Image?: string | null;
  Email?: string;
  Phone?: string;
  Location?: string | null;
  Status?: string;
  CreatedDate?: string | null;
  Address1?: string | null;
  Address2?: string | null;
  Country?: string | null;
  State?: string | null;
  City?: string | null;
  Pincode?: string | null;
}

interface ChildCompaniesResponse {
  data: {
    data: ChildCompanyRecord[];
  };
}

interface ListChildCompaniesResult {
  total: number;
  child_companies: ChildCompany[];
}

export const listChildCompaniesTool: ToolDefinition<
  typeof schema,
  ListChildCompaniesResult
> = {
  name: "list_child_companies",
  title:
    "List child / subsidiary companies under the parent tenant — names, contacts, locations & status",
  description:
    "Returns every child (subsidiary / Secondary) company tied to the caller's parent " +
    "organisation. Returned per child: id, company name, primary email, formatted phone (country " +
    "code + mobile), country / state / city / pincode, address line 1 and 2, social handles where " +
    "set (Instagram, Twitter / X, WhatsApp, LinkedIn, Facebook), creation date, logo URL, and " +
    "Active / Inactive status. Use this when the org runs multiple legal entities under one " +
    "parent tenant." +
    "\n\nUSE THIS TOOL TO:" +
    "\n• Map the multi-tenant org structure ('how many subsidiaries do we have?')" +
    "\n• Resolve a child-company NAME → id before scoping a report or query" +
    "\n• Get contact information (email, phone, address) for a specific subsidiary" +
    "\n• Build a directory of group companies for a leadership-style summary" +
    "\n\nNOTE:" +
    "\n• Only returns CHILD companies — the parent (Primary) company itself is not included. For " +
    "the parent's own configuration use get_company_settings; for the parent's employees use " +
    "list_employees." +
    "\n• Scoped to the caller's primary_company_id; child companies of a different parent are " +
    "never returned." +
    "\n• Soft-deleted child companies (status=2) are filtered out at the backend." +
    "\n• The Status field is a human-readable string ('Active' / 'Inactive'), not a numeric code — " +
    "pass through to the user verbatim." +
    "\n• The phone field is pre-formatted as 'country_code-mobile_no' — split on the dash if you " +
    "need parts.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["companies", "organization", "lookup"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<ChildCompaniesResponse>(
      `${SERVICE.USERS}/getChildCompanyList`,
      {},
      ctx,
      { injectCompanyContext: false },
    );

    const records = res?.data?.data ?? [];
    const childCompanies: ChildCompany[] = records.map((c) => ({
      id: c.key ?? 0,
      name: c.Company_Name ?? "Unknown",
      email: c.Email ?? "",
      phone: c.Phone ?? "",
      location: c.Location ?? null,
      status: c.Status ?? "Active",
      created_at: c.CreatedDate ?? null,
      address1: c.Address1 ?? null,
      address2: c.Address2 ?? null,
      country: c.Country ?? null,
      state: c.State ?? null,
      city: c.City ?? null,
      pincode: c.Pincode ?? null,
      logo_url: c.Image ?? null,
    }));

    return { total: childCompanies.length, child_companies: childCompanies };
  },
};

toolRegistry.register(listChildCompaniesTool);
