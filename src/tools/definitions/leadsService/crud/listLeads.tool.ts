/**
 * Answers: "Show me all leads for form X. List leads assigned to [user]."
 *
 * Calls /getAllLeadsResponse which returns fully-enriched lead records
 * (the backend already resolves: assigned_to_name, LeadFormName, Pipeline
 * stages, CompanyName). No extra lookup calls needed.
 *
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
      "The lead form ID to list leads from (required — use list_forms to discover available forms)",
    ),
  start_date: z
    .string()
    .default("2000-01-01")
    .describe("Start date filter in YYYY-MM-DD format (defaults to all-time)"),
  end_date: z
    .string()
    .optional()
    .describe(
      "End date filter in YYYY-MM-DD format (defaults to today if omitted)",
    ),
  stage: z
    .string()
    .optional()
    .describe(
      "Filter to a specific pipeline stage name (e.g. 'New', 'Contacted', 'Demo')",
    ),
  source: z
    .string()
    .optional()
    .describe(
      "Filter by lead source (parent), e.g. 'facebook', 'whatsapp', 'manual'",
    ),
  source_child: z
    .string()
    .optional()
    .describe("Filter by lead sub-source (child source)"),
  user_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Filter leads assigned to a specific user ID (omit to see all per your role)",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(20)
    .describe("Maximum number of leads to return"),
  offset: z.number().int().min(0).default(0).describe("Pagination offset"),
});

interface LeadItem {
  lead_id: number;
  name: string;
  phone: string;
  email: string;
  source: string;
  source_child: string | null;
  stage: string;
  priority: string;
  assigned_to_name: string;
  assigned_to_number: string | null;
  follow_up_date: string | null;
  form_name: string | null;
  created_at: string;
}

interface LeadStats {
  total_leads: number;
  today_leads: number;
  yesterday_leads: number;
  this_month_leads: number;
}

interface ListLeadsResult {
  form_id: number;
  returned: number;
  stats: LeadStats | null;
  leads: LeadItem[];
}

interface LeadRecord {
  key?: number;
  id?: number;
  LeadName?: string;
  Phone?: string;
  Email?: string;
  mobile_no?: string;
  email?: string;
  lead_source?: string;
  lead_source_child?: string;
  pipeline_char?: string;
  priority?: string;
  assigned_to_name?: string;
  assigned_to_number?: string;
  follow_up_date?: string;
  LeadFormName?: string;
  CreatedDate?: string;
  createdAt?: string;
  Items?: Record<string, number>;
}

interface LeadsResponse {
  data?: LeadRecord[];
  transferLeadIds?: number[];
}

export const listLeadsTool: ToolDefinition<typeof schema, ListLeadsResult> = {
  name: "list_leads",
  title: "List Leads",
  description:
    "Lists leads with full enriched details: name, phone, email, stage, priority, " +
    "assigned salesperson, follow-up date, and form name. " +
    "The backend already resolves all IDs to human-readable names — no extra lookups needed. " +
    "Use this to answer: Show me all leads this week. Who's assigned lead [form]? " +
    "How many leads came from Facebook? What leads are in the Demo stage? " +
    "IMPORTANT: form_id is required — use list_forms first if you don't know it.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "2.0.0", tags: ["leads", "list"] },

  handler: async (input, ctx) => {
    const today = new Date().toISOString().split("T")[0];
    const body: Record<string, unknown> = {
      form_id: input.form_id,
      start_date: input.start_date,
      end_date: input.end_date ?? today,
      limit: input.limit,
      offset: input.offset,
    };

    if (input.stage) body["pipeline_char"] = input.stage;
    if (input.source) body["parent_source"] = input.source;
    if (input.source_child) body["child_source"] = input.source_child;
    if (input.user_id !== undefined) body["user_id"] = input.user_id;

    const res = await apiPost<LeadsResponse>(`${SERVICE.LEADS}/getAllLeadsResponse`,
      body,
      ctx,
    );

    const records = res.data ?? [];

    // Extract stats from the first record's Items field (same for all)
    const rawItems = records[0]?.Items;
    const stats: LeadStats | null = rawItems
      ? {
          total_leads: rawItems["Total Leads"] ?? 0,
          today_leads: rawItems["Today's Leads"] ?? 0,
          yesterday_leads: rawItems["Yesterday's Leads"] ?? 0,
          this_month_leads: rawItems["This Month's Leads"] ?? 0,
        }
      : null;

    const leads: LeadItem[] = records.map((r) => ({
      lead_id: r.key ?? r.id ?? 0,
      name: r.LeadName ?? "Unknown",
      phone: r.Phone ?? r.mobile_no ?? "",
      email: r.Email ?? r.email ?? "",
      source: r.lead_source ?? "unknown",
      source_child: r.lead_source_child ?? null,
      stage: r.pipeline_char ?? "unknown",
      priority: r.priority ?? "Medium",
      assigned_to_name: r.assigned_to_name ?? "Unassigned",
      assigned_to_number: r.assigned_to_number ?? null,
      follow_up_date: r.follow_up_date ?? null,
      form_name: r.LeadFormName ?? null,
      created_at: r.CreatedDate ?? r.createdAt ?? "",
    }));

    return {
      form_id: input.form_id,
      returned: leads.length,
      stats,
      leads,
    };
  },
};

toolRegistry.register(listLeadsTool);
