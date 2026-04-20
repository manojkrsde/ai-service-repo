/**
 * Answers: "Which user is performing best? Rank by leads assigned or calls made."
 *
 * Fetches lead records for the time period, groups by assigned_to, and ranks.
 * Resolves user IDs to names via the user service.
 */
import { z } from "zod";

import { leadsPost } from "../../../../helpers/leads.client.js";
import { usersPost } from "../../../../helpers/users.client.js";
import { resolveDateRange } from "../../../../helpers/time-range.helper.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  metric: z
    .enum(["leads_assigned", "calls_made"])
    .default("leads_assigned")
    .describe("The performance dimension to rank users by"),
  time_range: z
    .enum(["today", "this_week", "this_month", "last_30_days"])
    .default("this_month")
    .describe("The time window to measure performance over"),
  top_n: z
    .number()
    .int()
    .min(1)
    .max(20)
    .default(5)
    .describe("Number of top performers to return"),
});

interface PerformanceEntry {
  rank: number;
  user_id: number;
  user_name: string;
  score: number;
  metric: string;
}

interface UserPerformanceRanking {
  metric: string;
  time_range: string;
  rankings: PerformanceEntry[];
}

interface LeadRecord {
  assigned_to?: number;
}

interface CallRecord {
  created_by?: number;
  user_id?: number;
}

interface AllLeadsResponse {
  data?: LeadRecord[];
}

interface AllCallsResponse {
  data?: CallRecord[];
}

interface UserRecord {
  id?: number;
  fname?: string;
  lname?: string;
  email?: string;
}

interface EmployeesResponse {
  data?: UserRecord[];
}

export const getUserPerformanceRankingTool: ToolDefinition<
  typeof schema,
  UserPerformanceRanking
> = {
  name: "get_user_performance_ranking",
  title: "Get User Performance Ranking",
  description:
    "Ranks users by how many leads they have been assigned or how many calls they have logged in a given time period. " +
    "Use this to answer: Who is the top performer this month? Which agent has the most assigned leads? " +
    "Who made the most calls this week?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["analytics", "users", "leads"] },

  handler: async (input, ctx) => {
    const dateRange = resolveDateRange(input.time_range);
    const baseBody: Record<string, unknown> = { limit: 2000, offset: 0 };
    if (dateRange) {
      baseBody["start_date"] = dateRange.start_date;
      baseBody["end_date"] = dateRange.end_date;
    }

    const counts: Record<number, number> = {};

    if (input.metric === "leads_assigned") {
      const res = await leadsPost<AllLeadsResponse>(
        "/getAllLeadsResponse",
        baseBody,
        ctx,
      );
      for (const lead of res.data ?? []) {
        if (lead.assigned_to !== undefined && lead.assigned_to !== null) {
          counts[lead.assigned_to] = (counts[lead.assigned_to] ?? 0) + 1;
        }
      }
    } else {
      const res = await leadsPost<AllCallsResponse>(
        "/getLeadCalls",
        baseBody,
        ctx,
      );
      for (const call of res.data ?? []) {
        const uid = call.user_id ?? call.created_by;
        if (uid !== undefined && uid !== null) {
          counts[uid] = (counts[uid] ?? 0) + 1;
        }
      }
    }

    const sorted = Object.entries(counts)
      .map(([uid, score]) => ({ user_id: Number(uid), score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, input.top_n);

    const nameMap = new Map<number, string>();
    try {
      const usersRes = await usersPost<EmployeesResponse>(
        "/getActiveEmployeesListData",
        {},
        ctx,
      );
      for (const u of usersRes.data ?? []) {
        if (u.id !== undefined) {
          const name = [u.fname, u.lname].filter(Boolean).join(" ") || u.email || `User ${u.id}`;
          nameMap.set(u.id, name);
        }
      }
    } catch {
      // If user service is unavailable, fall back to IDs
    }

    const rankings: PerformanceEntry[] = sorted.map((entry, i) => ({
      rank: i + 1,
      user_id: entry.user_id,
      user_name: nameMap.get(entry.user_id) ?? `User ${entry.user_id}`,
      score: entry.score,
      metric: input.metric,
    }));

    return {
      metric: input.metric,
      time_range: input.time_range,
      rankings,
    };
  },
};

toolRegistry.register(getUserPerformanceRankingTool);
