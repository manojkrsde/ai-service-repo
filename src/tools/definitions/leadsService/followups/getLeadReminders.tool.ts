/**
 * Answers: "What reminders are set for lead [ID]?"
 *
 * Derives per-lead reminders by filtering the form-scoped reminder
 * payload from `/getLeadReminder`. Pairs with `mark_reminder_done`.
 */
import { z } from "zod";

import { leadsPost } from "../../../../helpers/leads.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  lead_id: z
    .number()
    .int()
    .positive()
    .describe("The internal CRM ID of the lead"),
  form_id: z
    .number()
    .int()
    .positive()
    .describe(
      "The form the lead belongs to — required because backend scopes reminders by form",
    ),
});

interface ReminderEntry {
  reminder_id: number;
  lead_id: number;
  follow_up_date: string;
  bucket: "today" | "overdue" | "upcoming";
  assigned_to_name: string;
}

interface RemindersResult {
  lead_id: number;
  form_id: number;
  total: number;
  reminders: ReminderEntry[];
}

interface ReminderRecord {
  reminder_id?: number;
  key?: number;
  follow_up_date?: string;
  assigned_to_name?: string;
}

interface ReminderResponse {
  message?: {
    reminder?: {
      today?: ReminderRecord[];
      due?: ReminderRecord[];
      upcoming?: ReminderRecord[];
    };
  };
}

function toEntry(
  r: ReminderRecord,
  bucket: "today" | "overdue" | "upcoming",
): ReminderEntry {
  return {
    reminder_id: r.reminder_id ?? 0,
    lead_id: r.key ?? 0,
    follow_up_date: r.follow_up_date ?? "",
    bucket,
    assigned_to_name: r.assigned_to_name ?? "Unassigned",
  };
}

export const getLeadRemindersTool: ToolDefinition<
  typeof schema,
  RemindersResult
> = {
  name: "get_lead_reminders",
  title: "Get Lead Reminders",
  description:
    "Returns all pending follow-up reminders for a specific lead, " +
    "bucketed into today / overdue / upcoming. " +
    "Use when the user asks: What's pending on lead [X]? When do I need to call them back?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leads", "reminders"] },

  handler: async (input, ctx) => {
    const res = await leadsPost<ReminderResponse>(
      "/getLeadReminder",
      { form_id: input.form_id },
      ctx,
    );
    const reminder = res.message?.reminder ?? {};

    const all: ReminderEntry[] = [
      ...(reminder.due ?? []).map((r) => toEntry(r, "overdue")),
      ...(reminder.today ?? []).map((r) => toEntry(r, "today")),
      ...(reminder.upcoming ?? []).map((r) => toEntry(r, "upcoming")),
    ].filter((r) => r.lead_id === input.lead_id);

    return {
      lead_id: input.lead_id,
      form_id: input.form_id,
      total: all.length,
      reminders: all,
    };
  },
};

toolRegistry.register(getLeadRemindersTool);
