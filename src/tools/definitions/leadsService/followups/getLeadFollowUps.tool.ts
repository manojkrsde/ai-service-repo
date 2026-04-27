/**
 * Pending follow-up reminders for a form, bucketed today / overdue / upcoming.
 *
 * Wraps POST /getLeadReminder. Backend middleware requires
 * signature + form_id; company_id / company_type / limit / offset are
 * optional. Backend filters reminders to status=0 and pre-buckets them
 * by date relative to today.
 *
 * Response envelope is custom_message-wrapped:
 *   { message: { message: "Data Found", reminder: { today, due, upcoming, totalCount } } }
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
      "Lead form ID to scope reminders to. Use list_forms to discover form IDs.",
    ),
  filter: z
    .enum(["all", "today", "overdue", "upcoming"])
    .default("all")
    .describe(
      "Which bucket to return. 'all' returns overdue + today + upcoming concatenated (overdue first).",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum follow-ups to return after bucket filtering."),
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
  form_id: number;
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

interface ReminderEnvelope {
  message?: {
    reminder?: {
      today?: ReminderRecord[];
      due?: ReminderRecord[];
      upcoming?: ReminderRecord[];
      totalCount?: number;
    };
  };
}

function mapReminder(
  r: ReminderRecord,
  bucket: "today" | "overdue" | "upcoming",
): FollowUpEntry {
  return {
    reminder_id: r.reminder_id ?? 0,
    lead_id: r.key ?? 0,
    lead_name: r.LeadName ?? "Unknown",
    phone: r.mobile_no ?? "",
    email: r.email ?? "",
    follow_up_date: r.follow_up_date ?? "",
    stage: r.pipeline_char ?? "",
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
  title:
    "Get lead follow-ups — pending reminders bucketed today / overdue / upcoming",
  description:
    "Returns pending follow-up reminders for one form, sorted into three date buckets by the " +
    "backend: today (due today), overdue (already past), upcoming (future). Each entry " +
    "includes reminder_id (chain into mark_reminder_done), lead_id, lead_name, phone, email, " +
    "follow_up_date, current stage, assignee name, and form name. " +
    "\n\nUNDERSTANDING THE FLOW: Reminders are status=0 (pending) rows linked to leads. The " +
    "backend buckets them by date. Non-admin callers are auto-scoped to their own assigned " +
    "leads' reminders. " +
    "\n\nUSE THIS TOOL TO: build a 'today's follow-ups', 'I'm behind on X' or 'next week' " +
    "view; pair with mark_reminder_done to close items as they're handled. For overdue-only " +
    "with a min-days threshold use get_overdue_leads. For one specific lead's reminders use " +
    "get_lead_reminders.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "2.0.0", tags: ["leads", "follow-up", "reminders"] },

  handler: async (input, ctx) => {
    const res = await apiPost<ReminderEnvelope>(
      `${SERVICE.LEADS}/getLeadReminder`,
      { form_id: input.form_id },
      ctx,
    );

    const reminder = res.message?.reminder ?? {};
    const todayList = (reminder.today ?? []).map((r) =>
      mapReminder(r, "today"),
    );
    const overdueList = (reminder.due ?? []).map((r) =>
      mapReminder(r, "overdue"),
    );
    const upcomingList = (reminder.upcoming ?? []).map((r) =>
      mapReminder(r, "upcoming"),
    );

    let combined: FollowUpEntry[];
    if (input.filter === "today") combined = todayList;
    else if (input.filter === "overdue") combined = overdueList;
    else if (input.filter === "upcoming") combined = upcomingList;
    else combined = [...overdueList, ...todayList, ...upcomingList];

    const limited = combined.slice(0, input.limit);

    return {
      form_id: input.form_id,
      filter: input.filter,
      total_found: combined.length,
      follow_ups: limited,
    };
  },
};

toolRegistry.register(getLeadFollowUpsTool);
