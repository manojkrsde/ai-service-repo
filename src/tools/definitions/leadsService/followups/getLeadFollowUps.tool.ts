// AUDIT (v1):
// - Verdict: KEEP
// - Correctly wraps `/getLeadReminder`; sort into today/overdue/upcoming
//   is accurate.
// - Access: backend scopes by caller role (non-admin gets only their
//   assigned leads' reminders).

/**
 * Answers: "What follow-ups do I have today? Which leads am I behind on?"
 *
 * Calls /getLeadReminder which returns reminders pre-sorted into
 * today, due (overdue), and upcoming buckets.
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
      "The form ID to filter follow-ups for. Use list_forms to discover available forms.",
    ),
  filter: z
    .enum(["all", "today", "overdue", "upcoming"])
    .default("all")
    .describe(
      "Which reminders to return: today's only, overdue only, upcoming only, or all pending",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of follow-ups to return"),
});

interface FollowUpEntry {
  reminder_id: number;
  lead_id: number;
  lead_name: string;
  phone: string;
  email: string;
  follow_up_date: string;
  stage: string;
  assigned_to_name: string;
  form_name: string | null;
  bucket: "today" | "overdue" | "upcoming";
}

interface FollowUpsResult {
  filter: string;
  total_found: number;
  follow_ups: FollowUpEntry[];
}

interface ReminderRecord {
  reminder_id?: number;
  key?: number;
  mobile_no?: string;
  email?: string;
  follow_up_date?: string;
  pipeline_char?: string;
  assigned_to_name?: string;
  LeadName?: string;
  LeadFormName?: string | null;
}

interface ReminderResponse {
  message?: {
    reminder?: {
      today?: ReminderRecord[];
      due?: ReminderRecord[];
      upcoming?: ReminderRecord[];
      totalCount?: number;
    };
  };
}

function mapReminder(r: ReminderRecord, bucket: "today" | "overdue" | "upcoming"): FollowUpEntry {
  return {
    reminder_id: r.reminder_id ?? 0,
    lead_id: r.key ?? 0,
    lead_name: r.LeadName ?? "Unknown",
    phone: r.mobile_no ?? "",
    email: r.email ?? "",
    follow_up_date: r.follow_up_date ?? "",
    stage: r.pipeline_char ?? "unknown",
    assigned_to_name: r.assigned_to_name ?? "Unassigned",
    form_name: r.LeadFormName ?? null,
    bucket,
  };
}

export const getLeadFollowUpsTool: ToolDefinition<
  typeof schema,
  FollowUpsResult
> = {
  name: "get_lead_follow_ups",
  title: "Get Lead Follow-Ups",
  description:
    "Lists pending follow-up reminders for leads, sorted into today's, overdue, and upcoming buckets. " +
    "Use this when the user asks: What follow-ups do I have today? Which leads am I behind on? " +
    "Show me my overdue reminders. What's due this week?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leads", "follow-up", "reminders"] },

  handler: async (input, ctx) => {
    const res = await apiPost<ReminderResponse>(`${SERVICE.LEADS}/getLeadReminder`,
      { form_id: input.form_id },
      ctx,
    );

    const reminder = res.message?.reminder ?? {};
    const todayList = (reminder.today ?? []).map((r) => mapReminder(r, "today"));
    const overdueList = (reminder.due ?? []).map((r) => mapReminder(r, "overdue"));
    const upcomingList = (reminder.upcoming ?? []).map((r) => mapReminder(r, "upcoming"));

    let combined: FollowUpEntry[];

    if (input.filter === "today") {
      combined = todayList;
    } else if (input.filter === "overdue") {
      combined = overdueList;
    } else if (input.filter === "upcoming") {
      combined = upcomingList;
    } else {
      combined = [...overdueList, ...todayList, ...upcomingList];
    }

    const limited = combined.slice(0, input.limit);

    return {
      filter: input.filter,
      total_found: combined.length,
      follow_ups: limited,
    };
  },
};

toolRegistry.register(getLeadFollowUpsTool);
