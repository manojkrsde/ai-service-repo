/**
 * Leads with pending follow-up reminders whose due date has passed.
 *
 * Sourced from POST /getLeadReminder (pending reminders only, status=0).
 * The backend pre-buckets reminders into today / due (overdue) / upcoming;
 * this tool surfaces the `due` bucket with extra `days_overdue` metadata.
 *
 * Middleware requires signature + form_id; company_id / company_type / limit
 * / offset are optional. Non-admin callers are auto-scoped to their own leads.
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
  min_days_overdue: z
    .number()
    .int()
    .min(0)
    .default(1)
    .describe(
      "Minimum days past the follow-up date to include. 0 returns anything past due (including today's date that is already past).",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum overdue entries to return (sorted most-overdue-first)."),
});

interface OverdueEntry {
  reminder_id: number;
  lead_id: number;
  lead_name: string;
  phone: string;
  email: string;
  follow_up_date: string;
  days_overdue: number;
  stage: string;
  assigned_to_name: string;
  form_name: string | null;
}

interface OverdueResult {
  form_id: number;
  total_overdue: number;
  returned: number;
  overdue: OverdueEntry[];
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
      due?: ReminderRecord[];
    };
  };
}

function daysBetween(dateStr: string, today: Date): number {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return 0;
  d.setHours(0, 0, 0, 0);
  return Math.floor((today.getTime() - d.getTime()) / 86_400_000);
}

export const getOverdueLeadsTool: ToolDefinition<typeof schema, OverdueResult> =
  {
    name: "get_overdue_leads",
    title: "Get overdue leads — pending reminders past their follow-up date",
    description:
      "Returns leads whose pending follow-up reminders are past due. Each entry includes the " +
      "reminder_id (pair with mark_reminder_done), lead_id, lead_name, phone, email, original " +
      "follow_up_date, days_overdue (computed locally vs today), current pipeline stage, " +
      "assignee name, and form name. " +
      "\n\nUNDERSTANDING THE FLOW: A reminder is created with status=0; once acted on it flips " +
      "to status=1. The backend's `/getLeadReminder` endpoint already filters to status=0 and " +
      "buckets results by date. This tool surfaces only the `due` bucket and adds a " +
      "min_days_overdue floor so you can ask for 'anything 3+ days overdue'. Non-admin callers " +
      "are scoped server-side to leads they are assigned to. " +
      "\n\nUSE THIS TOOL TO: build an SLA-breach worklist, prioritise the day's outreach, or " +
      "answer 'who's slipping?' For today + upcoming reminders use get_lead_follow_ups; for " +
      "reminders on one specific lead use get_lead_reminders.",
    inputSchema: schema,
    annotations: { readOnlyHint: true, idempotentHint: true },
    meta: { version: "2.0.0", tags: ["analytics", "leads", "follow-up"] },

    handler: async (input, ctx) => {
      const res = await apiPost<ReminderEnvelope>(
        `${SERVICE.LEADS}/getLeadReminder`,
        { form_id: input.form_id },
        ctx,
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dueList = res.message?.reminder?.due ?? [];
      const overdue: OverdueEntry[] = [];

      for (const r of dueList) {
        const followUp = r.follow_up_date ?? "";
        const days = followUp ? daysBetween(followUp, today) : 0;
        if (days < input.min_days_overdue) continue;

        overdue.push({
          reminder_id: r.reminder_id ?? 0,
          lead_id: r.key ?? 0,
          lead_name: r.LeadName ?? "Unknown",
          phone: r.mobile_no ?? "",
          email: r.email ?? "",
          follow_up_date: followUp,
          days_overdue: days,
          stage: r.pipeline_char ?? "",
          assigned_to_name: r.assigned_to_name ?? "Unassigned",
          form_name: r.LeadFormName ?? null,
        });
      }

      overdue.sort((a, b) => b.days_overdue - a.days_overdue);
      const limited = overdue.slice(0, input.limit);

      return {
        form_id: input.form_id,
        total_overdue: overdue.length,
        returned: limited.length,
        overdue: limited,
      };
    },
  };

toolRegistry.register(getOverdueLeadsTool);
