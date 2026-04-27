/**
 * Comprehensive lead/deal stats for the dashboard.
 *
 * Wraps POST /getUserLeadStats (type=1) and /getUserDealStats (type=2), both
 * routed to backend `userLeadsStatsForDynamicDashboard`. Middleware requires
 * signature + company_id + company_type + type + optional filters.
 *
 * Backend returns: total/converted/lost/in_process counts with growth %,
 * conversion + losing rates, daily trends, source breakdown, per-employee
 * performers, and pipeline-wise stage distribution. Non-admin callers are
 * automatically scoped to their own leads server-side.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  kind: z
    .enum(["lead", "deal"])
    .default("lead")
    .describe(
      "'lead' returns lead stats (calls /getUserLeadStats, type=1). 'deal' returns deal stats (calls /getUserDealStats, type=2).",
    ),
  start_date: z
    .string()
    .optional()
    .describe(
      "Start of date range in YYYY-MM-DD. Omit both dates to use the backend's default (current month).",
    ),
  end_date: z.string().optional().describe("End of date range in YYYY-MM-DD."),
  employee_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Scope stats to a single employee (admin only — non-admin callers are auto-scoped to themselves).",
    ),
  department_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Scope stats to a department (admin only)."),
});

interface MetricWithGrowth {
  value: number;
  growth: number;
  previous: number;
}

interface UserLeadStatsResult {
  kind: "lead" | "deal";
  date_range_applied: unknown;
  totals: {
    total_new: MetricWithGrowth;
    converted: MetricWithGrowth;
    lost: MetricWithGrowth;
    in_process: MetricWithGrowth;
    conversion_rate: MetricWithGrowth;
    losing_rate: MetricWithGrowth;
  };
  daily_trends: unknown;
  sources: unknown;
  performers: unknown;
  pipeline_wise_distribution: unknown;
  pipelines: unknown;
}

interface StatsLeadsBlock {
  total_new?: MetricWithGrowth;
  converted?: MetricWithGrowth;
  lost?: MetricWithGrowth;
  in_process?: MetricWithGrowth;
  conversion_rate?: MetricWithGrowth;
  losing_rate?: MetricWithGrowth;
  daily_trends?: unknown;
  sources?: unknown;
  performers?: unknown;
  pipeline_wise_distribution?: unknown;
  pipelines?: unknown;
}

interface StatsResponse {
  data: {
    leads: StatsLeadsBlock;
    dateRangeApplied: unknown;
  };
}

const EMPTY_METRIC: MetricWithGrowth = { value: 0, growth: 0, previous: 0 };

export const getUserLeadStatsTool: ToolDefinition<
  typeof schema,
  UserLeadStatsResult
> = {
  name: "get_user_lead_stats",
  title:
    "Get lead/deal stats — personal dashboard or tenant-wide analytics with growth, trends, sources, performers, and pipelines",
  description:
    "Single source for all lead/deal performance questions — works as both a personal dashboard " +
    "(non-admin callers are auto-scoped server-side to their own leads) and a tenant-wide or " +
    "employee/department-scoped analytics view (admin only). " +
    "\n\nReturns:\n" +
    "  • Headline metrics (total_new, converted, lost, in_process) each with current value, " +
    "growth-vs-previous-period %, and previous-period value.\n" +
    "  • conversion_rate and losing_rate (also with growth comparison).\n" +
    "  • daily_trends — per-day counts split by pipeline.\n" +
    "  • sources — breakdown by lead_source / sub_source per pipeline + stage.\n" +
    "  • performers — per-employee counts with avg first-response hours.\n" +
    "  • pipeline_wise_distribution — stage-by-stage counts grouped by pipeline.\n" +
    "  • pipelines — ordered list of pipelines with their stages.\n" +
    "\n\nUNDERSTANDING THE FLOW: Non-admin callers automatically see only their own leads — " +
    "employee_id and department_id filters are silently ignored for them. Admins see all leads " +
    "by default and can narrow to one employee or department. Both lead and deal stats share " +
    "this tool — set kind='deal' to hit /getUserDealStats instead. " +
    "\n\nUSE THIS TOOL TO: answer 'how am I doing this month?' (personal dashboard), 'how many " +
    "leads converted vs last period?' (growth comparison), 'who is the top performer?' " +
    "(performers block), 'where do leads come from?' (sources block), or 'where in the pipeline " +
    "are leads stacking up?' (pipeline_wise_distribution). " +
    "\n\nNOTE: For per-city / per-state / per-country geographic breakdowns use " +
    "get_lead_stats_by_form_field. For raw stage-by-stage counts scoped to a single form use " +
    "get_overall_stage_counts.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["analytics", "leads", "dashboard"] },

  handler: async (input, ctx) => {
    const path =
      input.kind === "deal" ? "/getUserDealStats" : "/getUserLeadStats";
    const type = input.kind === "deal" ? 2 : 1;

    const filters: Record<string, unknown> = {};
    if (input.start_date && input.end_date) {
      filters["date_range"] = {
        start_date: input.start_date,
        end_date: input.end_date,
      };
    }
    if (input.employee_id !== undefined) {
      filters["employee_id"] = input.employee_id;
    }
    if (input.department_id !== undefined) {
      filters["department_id"] = input.department_id;
    }

    const body: Record<string, unknown> = { type };
    if (Object.keys(filters).length > 0) body["filters"] = filters;

    const res = await apiPost<StatsResponse>(
      `${SERVICE.LEADS}${path}`,
      body,
      ctx,
    );

    const leads = res.data?.leads ?? {};

    return {
      kind: input.kind,
      date_range_applied: res.data?.dateRangeApplied ?? null,
      totals: {
        total_new: leads.total_new ?? EMPTY_METRIC,
        converted: leads.converted ?? EMPTY_METRIC,
        lost: leads.lost ?? EMPTY_METRIC,
        in_process: leads.in_process ?? EMPTY_METRIC,
        conversion_rate: leads.conversion_rate ?? EMPTY_METRIC,
        losing_rate: leads.losing_rate ?? EMPTY_METRIC,
      },
      daily_trends: leads.daily_trends ?? null,
      sources: leads.sources ?? null,
      performers: leads.performers ?? null,
      pipeline_wise_distribution: leads.pipeline_wise_distribution ?? null,
      pipelines: leads.pipelines ?? [],
    };
  },
};

toolRegistry.register(getUserLeadStatsTool);
