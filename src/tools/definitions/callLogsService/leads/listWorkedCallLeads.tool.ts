/**
 * Lists call-center leads that have at least one call_log entry —
 * paginated, with rich filters and a reminder_preset shortcut.
 *
 * Wraps POST /get-used-call-logs. Backend Joi (mixed snake/camel):
 *   signature, companyId (required number), companyType (required string),
 *   status?, country?, state?, district?, city?, type?, reminder_preset?
 *   (overdue|today|tomorrow|custom), reminder_date_from?, reminder_date_to?,
 *   start_date?, end_date?, page?, limit? (default 30, max 100), search?
 * Company-context injection is suppressed because companyId is camelCase.
 *
 * Date filter (start_date / end_date) operates on the LATEST call_log's
 * `date` field (call_logs->-1->>'date'), not on the lead's createdAt.
 * If no date range is given the backend uses the last 90 days.
 *
 * Scoping: agents (caller's department matches call-management
 * department) see only leads assigned to them. Admins see all.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const REMINDER_PRESET = z.enum([
  "overdue",
  "today",
  "tomorrow",
  "custom",
]);

const schema = z.object({
  status: z
    .string()
    .optional()
    .describe("Lead status filter (e.g. 'assigned')."),
  country: z.string().optional().describe("Lower-cased exact match on country."),
  state: z.string().optional().describe("Lower-cased exact match on state."),
  district: z.string().optional().describe("Lower-cased exact match on district."),
  city: z.string().optional().describe("Lower-cased exact match on city."),
  type: z
    .string()
    .optional()
    .describe(
      "Filter on the latest call_log's `type` field (the user-supplied call outcome label, " +
        "e.g. 'INTERESTED', 'CALLBACK', 'NOT_INTERESTED' — not the numeric call_type).",
    ),
  reminder_preset: REMINDER_PRESET.optional().describe(
    "Quick filter on the latest call_log's reminder_date: 'overdue' = before today, " +
      "'today' = today, 'tomorrow' = tomorrow, 'custom' = use reminder_date_from / _to.",
  ),
  reminder_date_from: z
    .string()
    .optional()
    .describe("Reminder date range start (YYYY-MM-DD), only used when reminder_preset='custom'."),
  reminder_date_to: z
    .string()
    .optional()
    .describe("Reminder date range end (YYYY-MM-DD), only used when reminder_preset='custom'."),
  start_date: z
    .string()
    .optional()
    .describe(
      "Filter on the LATEST call_log's date (YYYY-MM-DD, inclusive). Default range is the " +
        "last 90 days when omitted.",
    ),
  end_date: z
    .string()
    .optional()
    .describe(
      "Filter on the LATEST call_log's date (YYYY-MM-DD, inclusive). Default is today when omitted.",
    ),
  search: z
    .string()
    .optional()
    .describe(
      "Lower-cased LIKE search across name, mobileNumber, state, city, district, email.",
    ),
  page: z.number().int().positive().default(1).describe("Page number (1-indexed)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(30)
    .describe("Page size, max 100 (backend caps it)."),
});

interface CallLogEntry {
  date?: string;
  type?: string;
  note?: string;
  reminder_date?: string;
}

interface WorkedLead {
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
  updated_at: string;
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

interface ListWorkedCallLeadsResult {
  pagination: Pagination;
  returned: number;
  leads: WorkedLead[];
}

interface WorkedLeadRecord {
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
  updatedAt?: string;
}

interface PaginationRecord {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

interface WorkedCallLeadsBody {
  data?: WorkedLeadRecord[];
  pagination?: PaginationRecord;
}

interface ListWorkedCallLeadsResponse {
  msg?: string;
  data?: WorkedCallLeadsBody;
}

export const listWorkedCallLeadsTool: ToolDefinition<
  typeof schema,
  ListWorkedCallLeadsResult
> = {
  name: "list_worked_call_leads",
  title:
    "List worked call leads — contacts with at least one call, with rich filters",
  description:
    "Returns leads from the call-center contact list that have at least one call_log entry, " +
    "paginated and ordered by latest call_log date DESC. Each lead includes id, name, email, " +
    "mobile_number, status, location, the assignee user_ids, and the FULL call_logs array " +
    "(sorted newest-first). Pagination metadata (total, page, limit, total_pages, has_next, " +
    "has_prev) is returned alongside. " +
    "\n\nUNDERSTANDING THE FLOW: The date filter (start_date / end_date) targets the LATEST " +
    "call_log entry's date field, not the lead's createdAt. The reminder_preset shortcut " +
    "lets you filter on the latest call_log's reminder_date without computing date math: " +
    "'overdue' = before today, 'today', 'tomorrow', or 'custom' with reminder_date_from/_to. " +
    "Non-admin agents see only their own assigned leads. " +
    "\n\nUSE THIS TOOL TO: answer 'show me leads I called this week with reminders today', " +
    "'find all call-back leads in Pune', 'who has overdue follow-ups?'. For leads that have " +
    "never been called, use list_unassigned_call_leads. For finding a specific lead by " +
    "phone or name without filters, use search_call_contacts. " +
    "\n\nNOTE: location filters are exact lower-cased matches; search is a LIKE match across " +
    "multiple columns. limit is capped at 100 by the backend even if you ask for more. The " +
    "`type` filter is the agent's call outcome label (a string the app stores on each " +
    "call_log), NOT the raw numeric call_type from t_user_call_logs.",
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
    if (input.country) body["country"] = input.country;
    if (input.state) body["state"] = input.state;
    if (input.district) body["district"] = input.district;
    if (input.city) body["city"] = input.city;
    if (input.type) body["type"] = input.type;
    if (input.reminder_preset) body["reminder_preset"] = input.reminder_preset;
    if (input.reminder_date_from)
      body["reminder_date_from"] = input.reminder_date_from;
    if (input.reminder_date_to)
      body["reminder_date_to"] = input.reminder_date_to;
    if (input.start_date) body["start_date"] = input.start_date;
    if (input.end_date) body["end_date"] = input.end_date;
    if (input.search) body["search"] = input.search;

    const res = await apiPost<ListWorkedCallLeadsResponse>(
      `${SERVICE.CALL_LOGS}/get-used-call-logs`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    const data = res.data ?? {};
    const records = data.data ?? [];
    const pag = data.pagination ?? {};

    const leads: WorkedLead[] = records.map((r) => ({
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
      updated_at: r.updatedAt ?? "",
    }));

    const pagination: Pagination = {
      total: pag.total ?? leads.length,
      page: pag.page ?? input.page,
      limit: pag.limit ?? input.limit,
      total_pages: pag.totalPages ?? 1,
      has_next_page: pag.hasNextPage ?? false,
      has_prev_page: pag.hasPrevPage ?? false,
    };

    return {
      pagination,
      returned: leads.length,
      leads,
    };
  },
};

toolRegistry.register(listWorkedCallLeadsTool);
