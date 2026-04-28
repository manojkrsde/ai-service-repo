/**
 * Lists call-center leads that have NOT been called yet (call_logs IS NULL).
 *
 * Wraps POST /get-call-logs-leads. Backend Joi (camelCase keys):
 *   signature, companyId (required number), companyType (required string),
 *   status?, state?, district?, page?, limit?
 * Note: NO start_date/end_date even though the controller would honour
 * them — Joi rejects unknown keys and the schema doesn't list them.
 * Therefore company-context injection is suppressed (snake_case
 * company_id would also be rejected) and the tool sends camelCase
 * companyId / companyType from ctx.
 *
 * Scoping: when the caller's department matches the call-management
 * department setting, req.id is set; the controller then filters to
 * leads with userIds JSONB containing that id (i.e. agents see only
 * leads assigned to them). employeeadmin / unmatched-department callers
 * see every unassigned lead.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  status: z
    .string()
    .optional()
    .describe(
      "Filter by lead status (e.g. 'unassigned', 'assigned'). Backend default already " +
        "limits to leads with call_logs IS NULL — status is an extra refinement.",
    ),
  state: z
    .string()
    .optional()
    .describe("Lower-cased exact match on the state column."),
  district: z
    .string()
    .optional()
    .describe("Lower-cased exact match on the district column."),
  page: z
    .number()
    .int()
    .positive()
    .default(1)
    .describe("Page number (1-indexed)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .default(100)
    .describe("Page size. Backend default if omitted is 10000 (one giant page)."),
});

interface CallLogEntry {
  date?: string;
  type?: string;
  note?: string;
  reminder_date?: string;
}

interface CallLeadItem {
  id: number;
  name: string;
  email: string | null;
  mobile_number: string;
  status: string;
  country: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  address: string | null;
  file_name: string | null;
  user_ids: number[];
  recent_call_logs: CallLogEntry[];
  created_at: string;
}

interface ListUnassignedCallLeadsResult {
  page: number;
  limit: number;
  returned: number;
  leads: CallLeadItem[];
}

interface CallLeadRecord {
  id?: number;
  name?: string;
  email?: string | null;
  mobileNumber?: string;
  status?: string;
  country?: string | null;
  state?: string | null;
  district?: string | null;
  city?: string | null;
  address?: string | null;
  file_name?: string | null;
  userIds?: number[];
  call_logs?: CallLogEntry[] | null;
  createdAt?: string;
  created_at?: string;
}

interface ListUnassignedCallLeadsResponse {
  msg?: string;
  data?: CallLeadRecord[];
}

export const listUnassignedCallLeadsTool: ToolDefinition<
  typeof schema,
  ListUnassignedCallLeadsResult
> = {
  name: "list_unassigned_call_leads",
  title:
    "List unassigned call leads — contacts in the queue with no calls yet",
  description:
    "Returns leads in the call-center contact queue that have NOT been called yet " +
    "(call_logs IS NULL). Each lead has id, name, email, mobile_number, status, location " +
    "(country/state/district/city), file_name (the upload batch it came from), the array of " +
    "assignee user_ids, and an empty/short recent_call_logs (since we filter to NULL — usually " +
    "[]; included for shape parity with list_worked_call_leads). " +
    "\n\nUNDERSTANDING THE FLOW: This is the 'work queue' for call agents. Non-admin agents " +
    "automatically see only leads assigned to them (userIds contains their ID). employeeadmin " +
    "and callers whose department doesn't match the call-management department see every " +
    "unassigned lead in the company. " +
    "\n\nUSE THIS TOOL TO: answer 'who do I still need to call?', 'how many fresh leads are " +
    "in Rahul's queue?', 'show me unassigned leads in Maharashtra'. For leads that already " +
    "have a call history use list_worked_call_leads instead. " +
    "\n\nNOTE: state and district filters are exact matches against the lower-cased column — " +
    "'maharashtra' will match 'Maharashtra' and 'MAHARASHTRA' but not 'Maharastra'. There is " +
    "no date filter even though the underlying table has createdAt — the backend's Joi schema " +
    "doesn't allow it.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calls", "leads"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      companyId: ctx.companyId,
      companyType: ctx.companyType,
      page: input.page,
      limit: input.limit,
    };
    if (input.status) body["status"] = input.status;
    if (input.state) body["state"] = input.state;
    if (input.district) body["district"] = input.district;

    const res = await apiPost<ListUnassignedCallLeadsResponse>(
      `${SERVICE.CALL_LOGS}/get-call-logs-leads`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    const records = res.data ?? [];
    const leads: CallLeadItem[] = records.map((r) => ({
      id: r.id ?? 0,
      name: r.name ?? "",
      email: r.email ?? null,
      mobile_number: r.mobileNumber ?? "",
      status: r.status ?? "unassigned",
      country: r.country ?? null,
      state: r.state ?? null,
      district: r.district ?? null,
      city: r.city ?? null,
      address: r.address ?? null,
      file_name: r.file_name ?? null,
      user_ids: r.userIds ?? [],
      recent_call_logs: r.call_logs ?? [],
      created_at: r.createdAt ?? r.created_at ?? "",
    }));

    return {
      page: input.page,
      limit: input.limit,
      returned: leads.length,
      leads,
    };
  },
};

toolRegistry.register(listUnassignedCallLeadsTool);
