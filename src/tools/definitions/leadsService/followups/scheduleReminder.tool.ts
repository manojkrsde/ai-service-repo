/**
 * Schedules a reminder with optional recurrence and note.
 *
 * Extended alternative to `add_lead_follow_up` when the user wants
 * to attach a note to the reminder or specify recurrence.
 * Calls /addLeadFollowUp with extended fields.
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
    .describe("The internal CRM ID of the lead to schedule a reminder for"),
  remind_at: z
    .string()
    .min(1)
    .describe(
      "When to trigger the reminder (ISO date or datetime, e.g. 2026-04-20T09:00:00Z)",
    ),
  note: z
    .string()
    .optional()
    .describe("What to remind about — shown alongside the reminder"),
  recurrence: z
    .enum(["none", "daily", "weekly", "monthly"])
    .default("none")
    .describe("How often to repeat the reminder (default: once only)"),
});

interface ScheduleReminderResult {
  success: boolean;
  lead_id: number;
  remind_at: string;
  reminder_id: number | null;
  recurrence: string;
}

interface FollowUpResponse {
  success?: boolean;
  data?: { id?: number };
  id?: number;
  message?: string;
}

export const scheduleReminderTool: ToolDefinition<
  typeof schema,
  ScheduleReminderResult
> = {
  name: "schedule_reminder",
  title: "Schedule Reminder",
  description:
    "Schedules a follow-up reminder for a lead with an optional note and recurrence. " +
    "Use when the user says: Remind me every week to check in with this lead. " +
    "Set a daily reminder for lead 45 at 9am. Schedule a one-time reminder with a note.",
  inputSchema: schema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  meta: { version: "1.0.0", tags: ["action", "leads", "reminders"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      lead_id: input.lead_id,
      follow_up_date: input.remind_at,
    };

    if (input.note) body["note"] = input.note;
    if (input.recurrence !== "none") body["recurrence"] = input.recurrence;

    const res = await leadsPost<FollowUpResponse>(
      "/addLeadFollowUp",
      body,
      ctx,
    );

    const reminderId = res.data?.id ?? res.id ?? null;

    return {
      success: true,
      lead_id: input.lead_id,
      remind_at: input.remind_at,
      reminder_id: reminderId,
      recurrence: input.recurrence,
    };
  },
};

toolRegistry.register(scheduleReminderTool);
