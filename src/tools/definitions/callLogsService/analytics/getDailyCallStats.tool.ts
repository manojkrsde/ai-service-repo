/**
 * Returns per-day-per-user call statistics within a date range.
 *
 * Wraps POST /getDailyCallStatistics. Backend Joi requires:
 *   signature, company_id, company_type, start_date, end_date,
 *   user_ids (REQUIRED ARRAY of positive integers — `min(0)` so `[]` is
 *   accepted and means "all users").
 * Default snake-case company-context injection is used.
 *
 * The handler always sends `user_ids` (defaults to `[]`) because the
 * backend rejects requests where the key is missing.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  start_date: z
    .string()
    .describe("Start date (YYYY-MM-DD, inclusive)."),
  end_date: z
    .string()
    .describe("End date (YYYY-MM-DD, inclusive)."),
  user_ids: z
    .array(z.number().int().positive())
    .default([])
    .describe(
      "Optional list of employee user IDs to restrict the breakdown to. " +
        "Pass [] (the default) to include every user that placed a call in the range.",
    ),
});

interface DailyStatRow {
  date: string;
  user_id: number;
  emp_id: string | number | null;
  user_name: string;
  username: string | null;
  image: string | null;
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
  connected_missed_calls: number;
  total_duration: number;
  incoming_duration: number;
  outgoing_duration: number;
  avg_incoming_duration: number;
  avg_outgoing_duration: number;
  last_call_time: string | null;
  last_connected_call_time: string | null;
}

interface GetDailyCallStatsResult {
  start_date: string;
  end_date: string;
  user_ids: number[];
  returned: number;
  rows: DailyStatRow[];
}

interface DailyStatRecord {
  date?: string;
  user_id?: number;
  emp_id?: string | number | null;
  user_name?: string;
  username?: string | null;
  image?: string | null;
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
  connected_missed_calls?: number;
  total_duration?: number;
  incoming_duration?: number;
  outgoing_duration?: number;
  avg_incoming_duration?: number;
  avg_outgoing_duration?: number;
  last_call_time?: string | null;
  last_connected_call_time?: string | null;
}

interface GetDailyCallStatsResponse {
  msg?: string;
  data?: DailyStatRecord[];
}

export const getDailyCallStatsTool: ToolDefinition<
  typeof schema,
  GetDailyCallStatsResult
> = {
  name: "get_daily_call_stats",
  title:
    "Get daily call stats — per-day, per-user breakdown of every call type",
  description:
    "Returns one row per (employee, day) within the date range with full call metrics: " +
    "total / incoming / outgoing / connected / not_connected / missed / voicemail / rejected / " +
    "blocked / answered_externally counts, total / incoming / outgoing duration sums (seconds), " +
    "average incoming + outgoing durations, last_call_time, last_connected_call_time, and " +
    "connected_missed_calls (numbers missed AND later connected). Each row includes user_name, " +
    "username (email), and emp_id resolved from the user-info service. " +
    "\n\nUNDERSTANDING THE FLOW: Pass user_ids=[] (the default) to include every user with a " +
    "call in the range; pass specific IDs to narrow it down. Rows are emitted only for " +
    "(user, day) pairs that actually had calls — days with zero activity are absent. " +
    "\n\nUSE THIS TOOL TO: answer 'show me Rahul's daily call counts last week', 'compare " +
    "the team's connect rate day-by-day this month', or build any report that needs " +
    "per-day granularity. For a single roll-up KPI use get_call_dashboard. For a single " +
    "employee's growth-vs-previous-period view use get_user_call_stats. " +
    "\n\nNOTE: All durations are in SECONDS. The backend orders by user_id ASC, then date " +
    "DESC (newest day first per user). user_ids must be an array — even an empty one — or " +
    "the backend rejects the request with HTTP 400.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calls", "analytics"] },

  handler: async (input, ctx) => {
    const res = await apiPost<GetDailyCallStatsResponse>(
      `${SERVICE.CALL_LOGS}/getDailyCallStatistics`,
      {
        start_date: input.start_date,
        end_date: input.end_date,
        user_ids: input.user_ids,
      },
      ctx,
    );

    const records = res.data ?? [];
    const rows: DailyStatRow[] = records.map((r) => ({
      date: r.date ?? "",
      user_id: r.user_id ?? 0,
      emp_id: r.emp_id ?? null,
      user_name: r.user_name ?? "",
      username: r.username ?? null,
      image: r.image ?? null,
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
      connected_missed_calls: r.connected_missed_calls ?? 0,
      total_duration: r.total_duration ?? 0,
      incoming_duration: r.incoming_duration ?? 0,
      outgoing_duration: r.outgoing_duration ?? 0,
      avg_incoming_duration: r.avg_incoming_duration ?? 0,
      avg_outgoing_duration: r.avg_outgoing_duration ?? 0,
      last_call_time: r.last_call_time ?? null,
      last_connected_call_time: r.last_connected_call_time ?? null,
    }));

    return {
      start_date: input.start_date,
      end_date: input.end_date,
      user_ids: input.user_ids,
      returned: rows.length,
      rows,
    };
  },
};

toolRegistry.register(getDailyCallStatsTool);
