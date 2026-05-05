import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  period: z
    .enum(["day", "week", "month", "year"])
    .default("month")
    .describe(
      "Trailing window for the time-series. day=last 24h, week=last 7 days, month=last 30 days, year=last 365 days.",
    ),
});

interface TimeSeriesPoint {
  date: string;
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

interface CategoryBucket {
  category: string;
  count: number;
}

interface StatisticsSummary {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

interface GetTicketStatisticsResult {
  period: "day" | "week" | "month" | "year";
  time_series: TimeSeriesPoint[];
  by_category: CategoryBucket[];
  summary: StatisticsSummary;
}

interface BackendStatsData {
  timeSeries?: TimeSeriesPoint[];
  byCategory?: CategoryBucket[];
  summary?: StatisticsSummary;
}

interface BackendMessageItem {
  msg?: string;
  status?: boolean;
  data?: BackendStatsData;
}

interface BackendEnvelope {
  message?: BackendMessageItem[] | BackendMessageItem;
}

function pickFirst(env: BackendEnvelope | undefined): BackendMessageItem {
  const m = env?.message;
  if (Array.isArray(m)) return m[0] ?? {};
  if (m && typeof m === "object") return m;
  return {};
}

export const getTicketStatisticsTool: ToolDefinition<
  typeof schema,
  GetTicketStatisticsResult
> = {
  name: "get_ticket_statistics",
  title: "Ticket statistics for the caller — time-series, per-category, summary",
  description:
    "Returns three blocks for tickets ASSIGNED TO the caller within a trailing window:" +
    "\n  • `time_series` — daily buckets `{ date, total, completed, inProgress, pending }`." +
    "\n  • `by_category` — counts grouped by category name." +
    "\n  • `summary` — totals for the whole window." +
    "\n\nUNDERSTANDING THE FLOW: Backend joins `t_tickets` filtered by " +
    "`assigned_to = caller`, status=1 (active) and operation_status in (2,3,4). The window is " +
    "computed from `now()` minus the chosen period. Categories are joined from " +
    "m_tickets_category. company_id / company_type are auto-injected." +
    "\n\nUSE THIS TOOL TO: drive personal performance charts, build burn-down style trends, or " +
    "answer 'how many tickets did I close this week?'." +
    "\n\nNOTE: This is per-user (the calling user's assigned tickets). For company-wide aggregate " +
    "counts use `get_ticket_counts`.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["tickets", "stats"] },

  handler: async (input, ctx) => {
    const res = await apiPost<BackendEnvelope>(
      `${SERVICE.TICKETS}/getTicketStatistics`,
      { period: input.period },
      ctx,
    );

    const data = pickFirst(res).data ?? {};

    return {
      period: input.period,
      time_series: data.timeSeries ?? [],
      by_category: data.byCategory ?? [],
      summary: data.summary ?? {
        total: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
      },
    };
  },
};

toolRegistry.register(getTicketStatisticsTool);
