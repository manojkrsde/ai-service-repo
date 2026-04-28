/**
 * Searches the call-center contact list by phone or name.
 *
 * Wraps POST /search-contact. Backend Joi requires only:
 *   signature, search (REQUIRED string).
 * The backend does NOT scope by company_id (a known bug — the controller
 * doesn't add it to the where clause), only by the caller's req.id when
 * non-admin. Therefore company-context injection is suppressed; only
 * `search` is sent.
 *
 * Phone normalisation: backend matches via case-insensitive LIKE on raw
 * mobileNumber. The phone helper is used so callers can pass any common
 * format and the longest digit run is sent.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import { normalizePhone } from "../../../../helpers/phone.helper.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  search: z
    .string()
    .trim()
    .min(2)
    .describe(
      "Phone number (any format) or partial name to look up. Tool extracts digits when " +
        "the input looks numeric so '+91 98765 43210' and '9876543210' both work.",
    ),
});

interface CallLogEntry {
  date?: string;
  type?: string;
  note?: string;
  reminder_date?: string;
}

interface ContactItem {
  id: number;
  name: string;
  email: string | null;
  mobile_number: string;
  status: string;
  country: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  user_ids: number[];
  call_logs: CallLogEntry[];
  created_at: string;
}

interface SearchCallContactsResult {
  query: string;
  effective_search: string;
  returned: number;
  contacts: ContactItem[];
}

interface ContactRecord {
  id?: number;
  name?: string;
  email?: string | null;
  mobileNumber?: string;
  status?: string;
  country?: string | null;
  state?: string | null;
  district?: string | null;
  city?: string | null;
  userIds?: number[];
  call_logs?: CallLogEntry[];
  createdAt?: string;
}

interface SearchCallContactsResponse {
  msg?: string;
  data?: ContactRecord[];
}

const isMostlyDigits = (s: string): boolean => {
  const digits = s.replace(/\D/g, "");
  return digits.length >= 4 && digits.length / s.length >= 0.6;
};

export const searchCallContactsTool: ToolDefinition<
  typeof schema,
  SearchCallContactsResult
> = {
  name: "search_call_contacts",
  title:
    "Search call contacts — find a lead in the call-center list by phone or name",
  description:
    "LIKE-searches the call-center contact list by mobileNumber and name (case-insensitive). " +
    "Returns up to all matching leads (no pagination), each with id, name, mobile_number, " +
    "status, location, assignee user_ids, the full call_logs history, and creation date. " +
    "Phone-style inputs are normalised (digits extracted) before sending so '+91 98765-43210' " +
    "and '9876543210' both find the same contact. " +
    "\n\nUNDERSTANDING THE FLOW: When the caller is a non-admin agent, results are restricted " +
    "to leads assigned to them (userIds JSONB contains their user_id). employeeadmin and " +
    "department-mismatched callers see ALL matching leads in the database — note the backend " +
    "does NOT additionally filter by company, so admin search results may include cross-company " +
    "rows in shared-database setups. " +
    "\n\nUSE THIS TOOL TO: answer 'do we have a lead for +919812345678?', 'find contacts " +
    "named Rahul Sharma', or to discover the canonical stored format of a phone before " +
    "calling get_call_journey (which requires an exact match). " +
    "\n\nNOTE: Backend requires search to be at least non-empty after trimming. The text " +
    "search uses a case-insensitive LIKE — partial matches work, but it is not fuzzy.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calls", "leads"] },

  handler: async (input, ctx) => {
    const trimmed = input.search.trim();
    let effective = trimmed;
    if (isMostlyDigits(trimmed)) {
      const normalized = normalizePhone(trimmed);
      effective = normalized.last10 || normalized.digits || trimmed;
    }

    const res = await apiPost<SearchCallContactsResponse>(
      `${SERVICE.CALL_LOGS}/search-contact`,
      { search: effective },
      ctx,
      { injectCompanyContext: false },
    );

    const records = res.data ?? [];
    const contacts: ContactItem[] = records.map((r) => ({
      id: r.id ?? 0,
      name: r.name ?? "",
      email: r.email ?? null,
      mobile_number: r.mobileNumber ?? "",
      status: r.status ?? "",
      country: r.country ?? null,
      state: r.state ?? null,
      district: r.district ?? null,
      city: r.city ?? null,
      user_ids: r.userIds ?? [],
      call_logs: r.call_logs ?? [],
      created_at: r.createdAt ?? "",
    }));

    return {
      query: input.search,
      effective_search: effective,
      returned: contacts.length,
      contacts,
    };
  },
};

toolRegistry.register(searchCallContactsTool);
