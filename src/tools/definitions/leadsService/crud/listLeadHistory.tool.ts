/**
 * Searches the historical lead database — every lead ever added that has
 * been (or is currently) assigned to someone.
 *
 * Wraps POST /getHistoryData (controller `getHistoryData`, middleware
 * `getQueuesHistoryDataCheckRules`). Companion to list_unassigned_leads:
 * that one returns the live unassigned queue, this one returns the
 * historical record across all assignees, with paginated server-side
 * search by source channel, form, date range, and free-text on
 * phone/email.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  source_type: z
    .enum(["all", "facebook", "whatsapp", "public_form", "crm", "unknown"])
    .default("all")
    .describe(
      "Source channel filter. 'all' returns every lead regardless of channel.",
    ),
  source_level_1: z
    .string()
    .optional()
    .nullable()
    .describe(
      "Sub-filter level 1 — WhatsApp phone_number_id when source_type='whatsapp'.",
    ),
  source_level_2: z
    .string()
    .optional()
    .nullable()
    .describe(
      "Sub-filter level 2 — Facebook page_id when source_type='facebook', share_link_id when source_type='public_form'.",
    ),
  source_level_3: z
    .string()
    .optional()
    .nullable()
    .describe(
      "Sub-filter level 3 — Facebook form_id when source_type='facebook'.",
    ),
  form_id: z
    .number()
    .int()
    .positive()
    .optional()
    .nullable()
    .describe(
      "Filter to a specific lead form (use list_forms to discover IDs).",
    ),
  assigned_to: z
    .string()
    .optional()
    .nullable()
    .describe(
      "Filter to leads assigned to a specific user_id. Stringly-typed per backend contract.",
    ),
  start_date: z
    .string()
    .optional()
    .nullable()
    .describe(
      "Start of date range in YYYY-MM-DD. Defaults to 3 months ago when omitted.",
    ),
  end_date: z
    .string()
    .optional()
    .nullable()
    .describe(
      "End of date range in YYYY-MM-DD. Defaults to today when omitted.",
    ),
  search_term: z
    .string()
    .optional()
    .default("")
    .describe(
      "Free-text search on email and mobile_no (server-side LIKE %term%).",
    ),
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

interface HistoryLead {
  lead_id: number;
  name: string;
  phone: string;
  email: string;
  source: string;
  source_child: string | null;
  pipeline_id: number | null;
  pipeline_stage: string;
  pipeline_stages: string[];
  priority: string;
  form_id: number | null;
  assigned_to: number | null;
  company_id: number;
  company_name: string;
  company_type: string;
  follow_up_date: string | null;
  created_at: string;
}

interface HistoryPagination {
  total: number;
  current_page: number;
  per_page: number;
  total_pages: number;
}

interface HistoryCounts {
  total: number;
  facebook: number;
  whatsapp: number;
  public_form: number;
  crm: number;
  unknown: number;
}

interface HistoryResult {
  returned: number;
  pagination: HistoryPagination;
  counts: HistoryCounts;
  leads: HistoryLead[];
}

interface HistoryLeadRecord {
  key?: number;
  id?: number;
  LeadName?: string;
  Phone?: string;
  Email?: string;
  mobile_no?: string;
  email?: string;
  lead_source?: string;
  lead_source_child?: string | null;
  pipeline_id?: number | null;
  pipeline_char?: string;
  Current_Pipeline_Char?: string;
  Pipeline?: string[];
  priority?: string;
  form_id?: number | null;
  assigned_to?: number | null;
  company_id?: number;
  company_type?: string;
  CompanyName?: string;
  company_name?: string;
  follow_up_date?: string;
  createdAt?: string;
  CreatedDate?: string;
}

interface HistoryDataPayload {
  leads: HistoryLeadRecord[];
  pagination: HistoryPagination;
  counts: HistoryCounts;
}

interface HistoryEnvelope {
  msg: string;
  status: boolean;
  data: HistoryDataPayload;
}

interface HistoryResponse {
  message: HistoryEnvelope[];
}

export const listLeadHistoryTool: ToolDefinition<typeof schema, HistoryResult> =
  {
    name: "list_lead_history",
    title:
      "Search lead history — every lead ever assigned, with source / form / date / text filters",
    description:
      "Returns the full historical lead record (every lead that has at any point been assigned " +
      "to someone), with paginated server-side filtering. Each entry includes: name, phone, " +
      "email, source channel + sub-source, current pipeline stage, full pipeline stage list, " +
      "priority, form, current assignee user_id, company, follow-up date, and creation date. " +
      "Also returns per-channel counts (facebook / whatsapp / public_form / crm / unknown) and " +
      "pagination metadata. " +
      "\n\nUNDERSTANDING THE FLOW: This is the historical companion to list_unassigned_leads. " +
      "list_unassigned_leads shows leads currently in the unassigned queue (assigned_to IS NULL); " +
      "list_lead_history shows the rest — leads that have been or are now assigned to a user. " +
      "Use either tool's `assigned_to` filter to drill into one user's portfolio. " +
      "\n\nUSE THIS TOOL TO: search the lead database by phone/email (search_term), find every " +
      "lead from a specific WhatsApp number / Facebook page / share link (source_level_*), pull " +
      "all leads on one form, slice by date range, or list a single user's leads via assigned_to. " +
      "\n\nNOTE: Pagination is server-side (page + limit, max 100/page). Date range defaults to " +
      "the last 3 months if both start_date and end_date are omitted. For a single lead's full " +
      "profile use get_lead_details.",
    inputSchema: schema,
    annotations: { readOnlyHint: true, idempotentHint: true },
    meta: { version: "1.0.0", tags: ["leads", "search", "history"] },

    handler: async (input, ctx) => {
      const body: Record<string, unknown> = {
        source_type: input.source_type,
        source_level_1: input.source_level_1 ?? null,
        source_level_2: input.source_level_2 ?? null,
        source_level_3: input.source_level_3 ?? null,
        form_id: input.form_id ?? null,
        assigned_to: input.assigned_to ?? null,
        start_date: input.start_date ?? null,
        end_date: input.end_date ?? null,
        search_term: input.search_term,
        page: input.page,
        limit: input.limit,
      };

      const res = await apiPost<HistoryResponse>(
        `${SERVICE.LEADS}/getHistoryData`,
        body,
        ctx,
      );

      const payload = res.message?.[0]?.data;

      const leads: HistoryLead[] = (payload?.leads ?? []).map((r) => ({
        lead_id: r.key ?? r.id ?? 0,
        name: r.LeadName ?? "Unknown",
        phone: r.Phone ?? r.mobile_no ?? "",
        email: r.Email ?? r.email ?? "",
        source: r.lead_source ?? "unknown",
        source_child: r.lead_source_child ?? null,
        pipeline_id: r.pipeline_id ?? null,
        pipeline_stage: r.Current_Pipeline_Char ?? r.pipeline_char ?? "",
        pipeline_stages: r.Pipeline ?? [],
        priority: r.priority ?? "Medium",
        form_id: r.form_id ?? null,
        assigned_to: r.assigned_to ?? null,
        company_id: r.company_id ?? 0,
        company_name: r.CompanyName ?? r.company_name ?? "",
        company_type: r.company_type ?? "",
        follow_up_date: r.follow_up_date ?? null,
        created_at: r.CreatedDate ?? r.createdAt ?? "",
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

toolRegistry.register(listLeadHistoryTool);
