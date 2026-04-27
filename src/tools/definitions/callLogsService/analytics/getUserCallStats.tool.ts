/**
 * Returns the dynamic call dashboard with current vs previous-period
 * growth — total / connected / disconnected / total_call_time /
 * avg_call_time / missed_calls — plus a per-user summary.
 *
 * Wraps POST /getUserCallStats. Backend Joi requires:
 *   signature, company_id, company_type, filters (optional object).
 * Default snake-case company-context injection is used.
 *
 * The backend defaults the date range to the last 30 days when filters
 * is omitted. When start_date / end_date are provided, the previous
 * period is computed as the equally-long window ending on the day
 * before start_date.
 *
 * Scoping: as with get_call_dashboard, non-employeeadmin callers are
 * automatically restricted to their own user_id. employeeadmins can
 * additionally narrow down via filters.employee_id.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  start_date: z
    .string()
    .optional()
    .describe(
      "Start of the current period (YYYY-MM-DD). When omitted along with end_date the " +
        "backend defaults to the last 30 days.",
    ),
  end_date: z
    .string()
    .optional()
    .describe("End of the current period (YYYY-MM-DD). Capped at today by the backend."),
  employee_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "When the caller is an employeeadmin, restrict the stats to a single employee. " +
        "Non-admin callers are always restricted to themselves regardless of this value.",
    ),
});

interface CallMetric {
  value: number;
  growth: number;
  previous: number;
}

interface UserCallSummary {
  user_id: number;
  user_name: string;
  email: string;
  profile_pic: string | null;
  total_calls: number;
  connected_calls: number;
  missed_calls: number;
  avg_duration: number;
  total_call_duration: number;
}

interface GetUserCallStatsResult {
  date_range_applied: boolean;
  total: CallMetric;
  connected: CallMetric;
  disconnected: CallMetric;
  total_call_time: CallMetric;
  avg_call_time: CallMetric;
  missed_calls: CallMetric;
  user_call_summary: UserCallSummary[];
}

interface CallMetricRecord {
  value?: number;
  growth?: number;
  previous?: number;
}

interface UserCallSummaryRecord {
  user_id?: number;
  user_name?: string;
  email?: string;
  profile_pic?: string | null;
  total_calls?: number;
  connected_calls?: number;
  missed_calls?: number;
  avg_duration?: number;
  total_call_duration?: number;
}

interface CallStatsBody {
  calls?: {
    total?: CallMetricRecord;
    connected?: CallMetricRecord;
    disconnected?: CallMetricRecord;
    total_call_time?: CallMetricRecord;
    avg_call_time?: CallMetricRecord;
    missed_calls?: CallMetricRecord;
    user_call_summary?: UserCallSummaryRecord[];
  };
  dateRangeApplied?: boolean;
}

interface GetUserCallStatsResponse {
  msg?: string;
  data?: CallStatsBody;
}

const emptyMetric = (m: CallMetricRecord | undefined): CallMetric => ({
  value: m?.value ?? 0,
  growth: m?.growth ?? 0,
  previous: m?.previous ?? 0,
});

export const getUserCallStatsTool: ToolDefinition<
  typeof schema,
  GetUserCallStatsResult
> = {
  name: "get_user_call_stats",
  title:
    "Get user call stats — current vs previous period KPIs with growth %",
  description:
    "Returns the team's call KPIs for the current period AND the equally-long previous " +
    "period, with growth % for each metric: total, connected, disconnected, total_call_time " +
    "(seconds), avg_call_time (seconds), missed_calls. Each metric is shaped as " +
    "{ value, growth, previous }. Also returns user_call_summary, a per-employee breakdown " +
    "(user_id, user_name, email, profile_pic, total_calls, connected_calls, missed_calls, " +
    "avg_duration, total_call_duration) sorted by total_calls DESC. " +
    "\n\nUNDERSTANDING THE FLOW: When start_date and end_date are both omitted, the backend " +
    "defaults to the last 30 days. The previous period is the equally-long window ending the " +
    "day before start_date. Non-admin callers are auto-scoped to themselves; an employeeadmin " +
    "may narrow to one teammate via employee_id. " +
    "\n\nUSE THIS TOOL TO: answer 'is the team improving on calls vs last month?', " +
    "'what's our connect-rate trend this quarter?', 'how does Rahul's volume compare to his " +
    "previous period?'. For a calendar-relative today/week/month snapshot use " +
    "get_call_dashboard; for per-day rows use get_daily_call_stats. " +
    "\n\nNOTE: date_range_applied is true if the caller passed an explicit window, false if " +
    "the backend defaulted. Durations are in seconds. growth is a percentage; treat 0 as " +
    "'no change OR previous-period was zero' (the SQL guards against divide-by-zero).",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calls", "analytics"] },

  handler: async (input, ctx) => {
    const filters: Record<string, unknown> = {};
    if (input.start_date !== undefined || input.end_date !== undefined) {
      filters["date_range"] = {
        start_date: input.start_date,
        end_date: input.end_date,
      };
    }
    if (input.employee_id !== undefined) {
      filters["employee_id"] = input.employee_id;
    }

    const res = await apiPost<GetUserCallStatsResponse>(
      `${SERVICE.CALL_LOGS}/getUserCallStats`,
      { filters },
      ctx,
    );

    const data = res.data ?? {};
    const calls = data.calls ?? {};
    const summaryRecords = calls.user_call_summary ?? [];

    const user_call_summary: UserCallSummary[] = summaryRecords.map((r) => ({
      user_id: r.user_id ?? 0,
      user_name: r.user_name ?? "",
      email: r.email ?? "",
      profile_pic: r.profile_pic ?? null,
      total_calls: r.total_calls ?? 0,
      connected_calls: r.connected_calls ?? 0,
      missed_calls: r.missed_calls ?? 0,
      avg_duration: r.avg_duration ?? 0,
      total_call_duration: r.total_call_duration ?? 0,
    }));

    return {
      date_range_applied: data.dateRangeApplied ?? false,
      total: emptyMetric(calls.total),
      connected: emptyMetric(calls.connected),
      disconnected: emptyMetric(calls.disconnected),
      total_call_time: emptyMetric(calls.total_call_time),
      avg_call_time: emptyMetric(calls.avg_call_time),
      missed_calls: emptyMetric(calls.missed_calls),
      user_call_summary,
    };
  },
};

toolRegistry.register(getUserCallStatsTool);
