/**
 * Returns the company's top-level call KPIs (today / weekly / monthly /
 * total) and a per-user breakdown for a date range.
 *
 * Wraps POST /getDashboardDetails. Backend Joi requires:
 *   signature, company_id, company_type, start_date, end_date.
 * Default snake-case company-context injection is used.
 *
 * Scoping: the middleware sets req.id to the caller ONLY IF they are NOT
 * an `employeeadmin` AND their department matches the company's
 * call-management department. So a non-admin sees only their own
 * userDetailData; an `employeeadmin` sees the full company.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  start_date: z
    .string()
    .describe(
      "Start date for the per-user breakdown (YYYY-MM-DD). The today/week/month KPIs " +
        "are calendar-based and ignore this parameter; only the per-user table uses it.",
    ),
  end_date: z
    .string()
    .describe(
      "End date for the per-user breakdown (YYYY-MM-DD).",
    ),
});

interface UserDetail {
  user_id: number;
  name: string;
  username: string;
  image: string | null;
  total_call_duration: number;
  total_calls: number;
  incoming_calls: number;
  outgoing_calls: number;
  connected_calls: number;
  not_connected_calls: number;
  missed_calls: number;
  voicemail_calls: number;
  rejected_calls: number;
  blocked_calls: number;
  answered_externally_calls: number;
  incoming_call_duration: number;
  outgoing_call_duration: number;
  avg_incoming_call_duration: number;
  avg_outgoing_call_duration: number;
  last_call_time: string | null;
  last_connected_call_time: string | null;
  connected_missed_calls: number;
}

interface GetCallDashboardResult {
  today_call: number;
  weekly_call: number;
  monthly_call: number;
  total_call_duration: number;
  total_call_duration_today: number;
  total_call_duration_weekly: number;
  total_call_duration_monthly: number;
  user_count: number;
  user_details: UserDetail[];
}

interface UserDetailRecord {
  user_id?: number;
  name?: string;
  username?: string;
  Image?: string | null;
  total_call_duration?: number;
  total_calls?: number;
  incoming_calls?: number;
  outgoing_calls?: number;
  connected_calls?: number;
  not_connected_calls?: number;
  missed_calls?: number;
  voicemail_calls?: number;
  rejected_calls?: number;
  blocked_calls?: number;
  answered_externally_calls?: number;
  incoming_call_duration?: number;
  outgoing_call_duration?: number;
  avg_incoming_call_duration?: number;
  avg_outgoing_call_duration?: number;
  last_call_time?: string | null;
  last_connected_call_time?: string | null;
  connected_missed_calls?: number;
}

interface DashboardData {
  today_call?: number;
  weekly_call?: number;
  monthly_call?: number;
  total_call_duration?: number;
  total_call_duration_today?: number;
  total_call_duration_weekly?: number;
  total_call_duration_monthly?: number;
  userDetailData?: UserDetailRecord[];
}

interface GetCallDashboardResponse {
  msg?: string;
  data?: DashboardData;
}

export const getCallDashboardTool: ToolDefinition<
  typeof schema,
  GetCallDashboardResult
> = {
  name: "get_call_dashboard",
  title:
    "Get call dashboard — today/week/month/total KPIs + per-user breakdown",
  description:
    "Returns the call-center dashboard summary: today_call, weekly_call, monthly_call counts " +
    "and matching duration totals (total_call_duration, _today, _weekly, _monthly — all in " +
    "seconds), plus a per-user breakdown for the specified date range with each agent's " +
    "incoming / outgoing / missed / connected / rejected / blocked / voicemail counts, " +
    "incoming + outgoing + average durations, last_call_time, last_connected_call_time, and " +
    "connected_missed_calls (numbers that were missed and later returned). " +
    "\n\nUNDERSTANDING THE FLOW: The today/week/month KPIs are calendar-relative and ignore " +
    "the date range — only the per-user table is filtered by start_date / end_date. " +
    "Non-admin (non-employeeadmin) callers only see their OWN row in user_details and the " +
    "KPIs are scoped to them; employeeadmin callers see the full company. " +
    "\n\nUSE THIS TOOL TO: answer 'how is the team doing on calls this week/month?', " +
    "'who's making the most outgoing calls?', 'what's our connect rate this month?'. " +
    "For finer-grained per-day-per-user numbers use get_daily_call_stats. For a single " +
    "employee's growth-vs-previous-period view use get_user_call_stats. " +
    "\n\nNOTE: All durations are in SECONDS. user_count reflects the number of agents that " +
    "had at least one call in the date range — not the headcount of the company.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calls", "analytics"] },

  handler: async (input, ctx) => {
    const res = await apiPost<GetCallDashboardResponse>(
      `${SERVICE.CALL_LOGS}/getDashboardDetails`,
      {
        start_date: input.start_date,
        end_date: input.end_date,
      },
      ctx,
    );

    const data = res.data ?? {};
    const records = data.userDetailData ?? [];

    const user_details: UserDetail[] = records.map((r) => ({
      user_id: r.user_id ?? 0,
      name: r.name ?? "",
      username: r.username ?? "",
      image: r.Image ?? null,
      total_call_duration: r.total_call_duration ?? 0,
      total_calls: r.total_calls ?? 0,
      incoming_calls: r.incoming_calls ?? 0,
      outgoing_calls: r.outgoing_calls ?? 0,
      connected_calls: r.connected_calls ?? 0,
      not_connected_calls: r.not_connected_calls ?? 0,
      missed_calls: r.missed_calls ?? 0,
      voicemail_calls: r.voicemail_calls ?? 0,
      rejected_calls: r.rejected_calls ?? 0,
      blocked_calls: r.blocked_calls ?? 0,
      answered_externally_calls: r.answered_externally_calls ?? 0,
      incoming_call_duration: r.incoming_call_duration ?? 0,
      outgoing_call_duration: r.outgoing_call_duration ?? 0,
      avg_incoming_call_duration: r.avg_incoming_call_duration ?? 0,
      avg_outgoing_call_duration: r.avg_outgoing_call_duration ?? 0,
      last_call_time: r.last_call_time ?? null,
      last_connected_call_time: r.last_connected_call_time ?? null,
      connected_missed_calls: r.connected_missed_calls ?? 0,
    }));

    return {
      today_call: data.today_call ?? 0,
      weekly_call: data.weekly_call ?? 0,
      monthly_call: data.monthly_call ?? 0,
      total_call_duration: data.total_call_duration ?? 0,
      total_call_duration_today: data.total_call_duration_today ?? 0,
      total_call_duration_weekly: data.total_call_duration_weekly ?? 0,
      total_call_duration_monthly: data.total_call_duration_monthly ?? 0,
      user_count: user_details.length,
      user_details,
    };
  },
};

toolRegistry.register(getCallDashboardTool);
