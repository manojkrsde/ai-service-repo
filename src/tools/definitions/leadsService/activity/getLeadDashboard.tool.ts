// AUDIT (v1):
// - Verdict: KEEP
// - Thin wrapper on `/leadDashboard`; backend produces per-caller totals,
//   trend counts, follow-up counts, and stage breakdowns.

/**
 * Answers: "How are my leads doing? What's the summary?"
 *
 * Calls /leadDashboard to get totals, trends, follow-up counts,
 * and stage breakdowns for the current user.
 */
import { z } from "zod";

import { leadsPost } from "../../../../helpers/leads.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  form_id: z
    .number()
    .int()
    .positive()
    .describe(
      "The form ID to scope dashboard stats to. Use list_forms to discover available forms.",
    ),
  pipeline_id: z
    .number()
    .int()
    .positive()
    .describe(
      "The pipeline ID to scope dashboard stats to. Use list_pipelines to discover available pipelines.",
    ),
});

interface StageData {
  stage_name: string;
  count: number;
}

interface FormStages {
  form_name: string;
  stages: StageData[];
}

interface LeadDashboardResult {
  total_leads: number;
  today_leads: number;
  this_week_leads: number;
  last_week_leads: number;
  week_over_week_change_pct: number;
  today_vs_last_week_change_pct: number;
  overdue_follow_ups: number;
  todays_follow_ups: number;
  lead_stages: FormStages[];
}

interface DashboardStageEntry {
  pipeline_char?: string;
  stage_count?: number;
}

interface DashboardFormEntry {
  name?: string;
  stages_data?: DashboardStageEntry[];
}

interface DashboardResponse {
  data?: {
    totalLeads?: number;
    todayLeads?: number;
    thisWeekLeads?: number;
    lastWeekLeads?: number;
    weekDifference?: number;
    todayDifference?: number;
    total_follow_up_pending_list?: unknown[];
    total_follow_up_list_today?: unknown[];
    leadStages?: DashboardFormEntry[];
  };
}

export const getLeadDashboardTool: ToolDefinition<
  typeof schema,
  LeadDashboardResult
> = {
  name: "get_lead_dashboard",
  title: "Get Lead Dashboard",
  description:
    "Returns your personal lead dashboard: total leads, today's and this week's counts, " +
    "week-over-week change percentages, overdue follow-up counts, and a stage breakdown by form. " +
    "Use this when the user asks: How are my leads looking? What's my lead summary? " +
    "How did today compare to last week?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["analytics", "leads", "dashboard"] },

  handler: async (input, ctx) => {
    const res = await leadsPost<DashboardResponse>(
      "/leadDashboard",
      {
        form_id: input.form_id,
        pipeline_id: input.pipeline_id,
      },
      ctx,
    );

    const d = res.data ?? {};

    const leadStages: FormStages[] = (d.leadStages ?? []).map((form) => ({
      form_name: form.name ?? "Unknown Form",
      stages: (form.stages_data ?? []).map((s) => ({
        stage_name: s.pipeline_char ?? "Unknown",
        count: s.stage_count ?? 0,
      })),
    }));

    return {
      total_leads: d.totalLeads ?? 0,
      today_leads: d.todayLeads ?? 0,
      this_week_leads: d.thisWeekLeads ?? 0,
      last_week_leads: d.lastWeekLeads ?? 0,
      week_over_week_change_pct: Math.round(d.weekDifference ?? 0),
      today_vs_last_week_change_pct: Math.round(d.todayDifference ?? 0),
      overdue_follow_ups: (d.total_follow_up_pending_list ?? []).length,
      todays_follow_ups: (d.total_follow_up_list_today ?? []).length,
      lead_stages: leadStages,
    };
  },
};

toolRegistry.register(getLeadDashboardTool);
