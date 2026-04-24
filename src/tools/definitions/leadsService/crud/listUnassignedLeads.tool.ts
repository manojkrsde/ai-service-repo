/**
 * Answers: "Which leads are unassigned? What's sitting in the queue?"
 *
 * Calls POST /getQueuesData — middleware requires signature (auto-injected),
 * company_id + company_type (auto-injected), form_id, and source_type.
 * Pagination is server-side. Backend also applies department scoping if the
 * authenticated user is a department-restricted employee.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  form_id: z
    .number()
    .int()
    .positive()
    .describe(
      "Required. Lead form ID to scope the queue to. Use list_forms to discover form IDs.",
    ),
  source_type: z
    .enum(["all", "facebook", "whatsapp", "public_form", "crm", "unknown"])
    .default("all")
    .describe(
      "Filter queue by lead source channel. 'all' returns every unassigned lead regardless of source.",
    ),
  source_level_1: z
    .string()
    .optional()
    .nullable()
    .describe(
      "Sub-filter level 1 — WhatsApp phone_number_id when source_type is 'whatsapp'",
    ),
  source_level_2: z
    .string()
    .optional()
    .nullable()
    .describe(
      "Sub-filter level 2 — Facebook page_id when source_type is 'facebook', share_link_id when 'public_form'",
    ),
  source_level_3: z
    .string()
    .optional()
    .nullable()
    .describe(
      "Sub-filter level 3 — Facebook form_id when source_type is 'facebook'",
    ),
  start_date: z
    .string()
    .optional()
    .nullable()
    .describe(
      "Start of date range in YYYY-MM-DD format. Defaults to 3 months ago when omitted.",
    ),
  end_date: z
    .string()
    .optional()
    .nullable()
    .describe(
      "End of date range in YYYY-MM-DD format. Defaults to today when omitted.",
    ),
  search_term: z
    .string()
    .optional()
    .default("")
    .describe("Search by email or mobile number (partial match)."),
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number for server-side pagination (starts at 1)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(30)
    .describe("Records per page — backend maximum is 100."),
});

interface QueueLead {
  lead_id: number;
  name: string;
  phone: string;
  email: string;
  source: string;
  source_child: string | null;
  form_id: number | null;
  company_id: number;
  company_type: string;
  created_at: string;
}

interface QueuePagination {
  total: number;
  current_page: number;
  per_page: number;
  total_pages: number;
}

interface QueueCounts {
  total: number;
  facebook: number;
  whatsapp: number;
  public_form: number;
  crm: number;
  unknown: number;
}

interface UnassignedResult {
  returned: number;
  pagination: QueuePagination;
  counts: QueueCounts;
  leads: QueueLead[];
}

interface QueueLeadRecord {
  key?: number;
  id?: number;
  LeadName?: string;
  Phone?: string;
  Email?: string;
  mobile_no?: string;
  email?: string;
  lead_source?: string;
  lead_source_child?: string | null;
  form_id?: number | null;
  company_id?: number;
  company_type?: string;
  createdAt?: string;
  CreatedDate?: string;
  response?: Record<string, unknown>;
  source_details?: Record<string, unknown> | null;
}

interface QueueDataPayload {
  leads: QueueLeadRecord[];
  pagination: QueuePagination;
  counts: QueueCounts;
  employees: unknown[];
  filtered_count: number;
  hierarchy: {
    facebook: unknown[];
    whatsapp: unknown[];
    public_form: unknown[];
  };
  source_type: string;
  filters_applied: {
    source_level_1: string | null;
    source_level_2: string | null;
    source_level_3: string | null;
  };
}

interface QueueDataEnvelope {
  msg: string;
  status: boolean;
  data: QueueDataPayload;
}

interface QueueDataResponse {
  message: QueueDataEnvelope[];
}

export const listUnassignedLeadsTool: ToolDefinition<
  typeof schema,
  UnassignedResult
> = {
  name: "list_unassigned_leads",
  title: "List unassigned leads — queue of leads waiting for an owner",
  description:
    "Returns leads with no assignee (leads in queue) — the queue waiting for a salesperson to pick them up. " +
    "Each lead includes: name, phone, email, source channel, form, company, and creation date. " +
    "Also returns server-side pagination info and source-channel counts (facebook, whatsapp, " +
    "public_form, crm, unknown). " +
    "\n\nUNDERSTANDING THE FLOW: When a lead is captured it sits in the queue until assigned " +
    "(manually or by auto-assignment rules). Department-scoped employees see only leads from " +
    "their department — this is enforced server-side. " +
    "\n\nUSE THIS TOOL TO: show the unassigned queue for a form, count how many leads are " +
    "waiting per source channel, filter by WhatsApp account or Facebook page, or search by " +
    "phone/email. " +
    "\n\nNOTE: form_id is always required — use list_forms to discover it. Pagination is " +
    "server-side (page + limit, max 100 per page). For assigned leads use list_leads instead.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "3.0.0", tags: ["leads", "queue"] },

  handler: async (input, ctx) => {
    const res = await apiPost<QueueDataResponse>(
      `${SERVICE.LEADS}/getQueuesData`,
      {
        form_id: input.form_id,
        source_type: input.source_type,
        source_level_1: input.source_level_1 ?? null,
        source_level_2: input.source_level_2 ?? null,
        source_level_3: input.source_level_3 ?? null,
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        search_term: input.search_term,
        page: input.page,
        limit: input.limit,
      },
      ctx,
    );

    const payload = res.message[0]?.data;

    const leads: QueueLead[] = (payload?.leads ?? []).map((r) => ({
      lead_id: r.key ?? r.id ?? 0,
      name: r.LeadName ?? "Unknown",
      phone: r.Phone ?? r.mobile_no ?? "",
      email: r.Email ?? r.email ?? "",
      source: r.lead_source ?? "unknown",
      source_child: r.lead_source_child ?? null,
      form_id: r.form_id ?? null,
      company_id: r.company_id ?? 0,
      company_type: r.company_type ?? "",
      created_at: r.createdAt ?? r.CreatedDate ?? "",
    }));

    return {
      returned: leads.length,
      pagination: payload?.pagination ?? {
        total: 0,
        current_page: input.page,
        per_page: input.limit,
        total_pages: 0,
      },
      counts: payload?.counts ?? {
        total: 0,
        facebook: 0,
        whatsapp: 0,
        public_form: 0,
        crm: 0,
        unknown: 0,
      },
      leads,
    };
  },
};

toolRegistry.register(listUnassignedLeadsTool);
