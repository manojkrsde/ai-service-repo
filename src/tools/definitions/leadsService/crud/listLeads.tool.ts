/**
 * Answers: "Show me leads matching [structured filters]."
 *
 * Replaces the structured half of the old `search_leads` tool. All
 * filters map directly to `/getAllLeadsResponse`; backend handles role
 * scoping via middleware.
 */
import { z } from "zod";

import {
  createEnrichmentCache,
  enrichLeads,
  type EnrichedLead,
  type LeadLike,
} from "../../../../helpers/lead-enrichment.helper.js";
import { leadsPost } from "../../../../helpers/leads.client.js";
import { resolveDateRange } from "../../../../helpers/time-range.helper.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  source: z
    .string()
    .optional()
    .describe(
      "Filter by lead source, e.g. facebook, whatsapp, public_form, manual",
    ),
  stage: z
    .string()
    .optional()
    .describe("Filter by pipeline stage name, e.g. Qualified, Demo Scheduled"),
  priority: z
    .enum(["low", "medium", "high", "urgent"])
    .optional()
    .describe("Filter by priority level"),
  assigned_to: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Filter leads assigned to a specific user ID"),
  form_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Scope to a specific form"),
  pipeline_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Scope to a specific pipeline"),
  time_range: z
    .enum(["today", "this_week", "this_month", "last_30_days", "custom", "all_time"])
    .default("all_time")
    .describe("Limit to leads created within this window"),
  start_date: z
    .string()
    .optional()
    .describe("Custom range start (YYYY-MM-DD) — only when time_range=custom"),
  end_date: z
    .string()
    .optional()
    .describe("Custom range end (YYYY-MM-DD) — only when time_range=custom"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Number of results to return"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Pagination offset"),
});

interface ListLeadsResult {
  total_count: number;
  returned: number;
  offset: number;
  leads: EnrichedLead[];
}

interface LeadRecord extends LeadLike {
  id?: number;
}

interface AllLeadsResponse {
  data?: LeadRecord[];
  total_count?: number;
}

export const listLeadsTool: ToolDefinition<typeof schema, ListLeadsResult> = {
  name: "list_leads",
  title: "List Leads",
  description:
    "Lists leads matching structured filters (source, stage, priority, assigned user, " +
    "form, pipeline, time range). Supports pagination. " +
    "Use when the user asks: Show me all Facebook leads from this week. " +
    "List urgent leads assigned to user 12. Find leads in Qualified stage this month.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leads", "list"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      limit: input.limit,
      offset: input.offset,
    };

    if (input.source) body["lead_source"] = input.source;
    if (input.stage) body["pipeline_char"] = input.stage;
    if (input.priority) body["priority"] = input.priority;
    if (input.assigned_to !== undefined) body["assigned_to"] = input.assigned_to;
    if (input.form_id !== undefined) body["form_id"] = input.form_id;
    if (input.pipeline_id !== undefined) body["pipeline_id"] = input.pipeline_id;

    const range = resolveDateRange(
      input.time_range,
      input.start_date,
      input.end_date,
    );
    if (range) {
      body["start_date"] = range.start_date;
      body["end_date"] = range.end_date;
    }

    const res = await leadsPost<AllLeadsResponse>(
      "/getAllLeadsResponse",
      body,
      ctx,
    );

    const leads = res.data ?? [];
    const enriched = await enrichLeads(leads, ctx, createEnrichmentCache());

    return {
      total_count: res.total_count ?? enriched.length,
      returned: enriched.length,
      offset: input.offset,
      leads: enriched,
    };
  },
};

toolRegistry.register(listLeadsTool);
