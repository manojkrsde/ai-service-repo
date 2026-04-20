// AUDIT (v1):
// - Verdict: KEEP
// - Good dimension/time-range coverage; delegates grouping + percentages
//   locally over `/leadDashboard` output.
// - Access: backend auto-scopes the dashboard for non-admins.

/**
 * Answers: "How many leads came in today / this week / this month?
 *           Break it down by source / stage / priority / form."
 *
 * Calls /leadDashboard for totals, then groups the returned data by the
 * requested dimension.  Percentages are computed locally.
 */
import { z } from "zod";

import { leadsPost } from "../../../../helpers/leads.client.js";
import { resolveDateRange } from "../../../../helpers/time-range.helper.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  time_range: z
    .enum(["today", "this_week", "this_month", "last_30_days", "custom"])
    .default("this_week")
    .describe("The time window to count leads over"),
  start_date: z
    .string()
    .optional()
    .describe('ISO date (YYYY-MM-DD) — required when time_range is "custom"'),
  end_date: z
    .string()
    .optional()
    .describe('ISO date (YYYY-MM-DD) — required when time_range is "custom"'),
  group_by: z
    .enum(["source", "stage", "priority", "form"])
    .default("source")
    .describe("Dimension to break down the counts"),
  pipeline_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Scope results to a specific pipeline (optional)"),
});

interface BreakdownItem {
  label: string;
  count: number;
  percentage: number;
}

interface LeadVolumeStats {
  total: number;
  time_range: string;
  group_by: string;
  breakdown: BreakdownItem[];
}

interface DashboardResponse {
  data?: {
    total_leads?: number;
    leads_by_source?: Record<string, number>;
    leads_by_priority?: Record<string, number>;
    leads_by_stage?: Record<string, number>;
    leads_by_form?: Record<string, number>;
  };
}

interface AllLeadsResponse {
  data?: Array<{
    lead_source?: string;
    priority?: string;
    pipeline_char?: string;
    form_id?: number;
  }>;
  total_count?: number;
}

function buildBreakdown(
  counts: Record<string, number>,
  total: number,
): BreakdownItem[] {
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([label, count]) => ({
      label,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
}

export const getLeadVolumeStatsTool: ToolDefinition<
  typeof schema,
  LeadVolumeStats
> = {
  name: "get_lead_volume_stats",
  title: "Get Lead Volume Stats",
  description:
    "Returns the total number of leads received in a given time period, broken down by source, stage, priority, or form. " +
    "Use this to answer questions like: How many leads came in today? Which source brings the most leads? " +
    "How are leads distributed across priorities this week?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["analytics", "leads"] },

  handler: async (input, ctx) => {
    const dateRange = resolveDateRange(
      input.time_range === "custom" ? "custom" : input.time_range,
      input.start_date,
      input.end_date,
    );

    const baseBody: Record<string, unknown> = {};
    if (dateRange) {
      baseBody["start_date"] = dateRange.start_date;
      baseBody["end_date"] = dateRange.end_date;
    }
    if (input.pipeline_id !== undefined) {
      baseBody["pipeline_id"] = input.pipeline_id;
    }

    const dashboard = await leadsPost<DashboardResponse>(
      "/leadDashboard",
      baseBody,
      ctx,
    );

    const dashboardData = dashboard.data ?? {};
    const total = dashboardData.total_leads ?? 0;

    let aggregated: Record<string, number> | undefined;

    if (input.group_by === "source" && dashboardData.leads_by_source) {
      aggregated = dashboardData.leads_by_source;
    } else if (
      input.group_by === "priority" &&
      dashboardData.leads_by_priority
    ) {
      aggregated = dashboardData.leads_by_priority;
    } else if (input.group_by === "stage" && dashboardData.leads_by_stage) {
      aggregated = dashboardData.leads_by_stage;
    } else if (input.group_by === "form" && dashboardData.leads_by_form) {
      aggregated = dashboardData.leads_by_form;
    }

    if (!aggregated) {
      const raw = await leadsPost<AllLeadsResponse>(
        "/getAllLeadsResponse",
        { ...baseBody, limit: 2000, offset: 0 },
        ctx,
      );

      const counts: Record<string, number> = {};
      for (const lead of raw.data ?? []) {
        let key: string;
        if (input.group_by === "source") {
          key = lead.lead_source ?? "unknown";
        } else if (input.group_by === "priority") {
          key = lead.priority ?? "unknown";
        } else if (input.group_by === "stage") {
          key = lead.pipeline_char ?? "unknown";
        } else {
          key = lead.form_id !== undefined ? String(lead.form_id) : "unknown";
        }
        counts[key] = (counts[key] ?? 0) + 1;
      }
      aggregated = counts;
    }

    const resolvedTotal =
      total > 0
        ? total
        : Object.values(aggregated).reduce((s, n) => s + n, 0);

    return {
      total: resolvedTotal,
      time_range: input.time_range,
      group_by: input.group_by,
      breakdown: buildBreakdown(aggregated, resolvedTotal),
    };
  },
};

toolRegistry.register(getLeadVolumeStatsTool);
