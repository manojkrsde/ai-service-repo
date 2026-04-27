/**
 * Per-lead pending reminders, derived client-side by filtering the
 * form-scoped /getLeadReminder payload.
 *
 * The backend has no per-lead reminder endpoint, but /getLeadReminder
 * (form-scoped, status=0) returns enough to filter locally by lead_id.
 * Pairs with mark_reminder_done.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  lead_id: z
    .number()
    .int()
    .positive()
    .describe("Internal CRM ID of the lead."),
  form_id: z
    .number()
    .int()
    .positive()
    .describe(
      "Form ID the lead belongs to (required because the backend's reminder endpoint scopes by form). Use list_forms or get_lead_details to discover it.",
    ),
});

interface ReminderEntry {
  reminder_id: number;
  lead_id: number;
  follow_up_date: string;
  bucket: "today" | "overdue" | "upcoming";
  stage: string;
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
  pipeline_char?: string;
  assigned_to_name?: string;
}

interface ReminderEnvelope {
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
    stage: r.pipeline_char ?? "",
    assigned_to_name: r.assigned_to_name ?? "Unassigned",
  };
}

export const getLeadRemindersTool: ToolDefinition<
  typeof schema,
  RemindersResult
> = {
  name: "get_lead_reminders",
  title: "Get lead reminders — pending reminders for a single lead, bucketed",
  description:
    "Returns all pending follow-up reminders (status=0) for one specific lead, bucketed into " +
    "today / overdue / upcoming. Each entry has reminder_id (chain into mark_reminder_done), " +
    "follow_up_date, current stage, and assignee name. " +
    "\n\nUNDERSTANDING THE FLOW: The backend's reminder endpoint is form-scoped, not " +
    "lead-scoped. This tool fetches the full form payload and filters client-side to the " +
    "given lead. form_id is therefore required — use get_lead_details or list_forms to " +
    "resolve it. Non-admin callers see only reminders on leads they are assigned to. " +
    "\n\nUSE THIS TOOL TO: open a single lead and ask 'what reminders are pending here?'. For " +
    "the form-wide bucket view use get_lead_follow_ups; for overdue-only across the form use " +
    "get_overdue_leads.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "2.0.0", tags: ["leads", "reminders"] },

  handler: async (input, ctx) => {
    const res = await apiPost<ReminderEnvelope>(
      `${SERVICE.LEADS}/getLeadReminder`,
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
