// AUDIT (v1):
// - Verdict: REWRITE
// - Rewritten: uses `/getLeadReminder` as source of truth (pending
//   reminders only, status=0) instead of the lead's stale follow_up_date.

/**
 * Answers: "Which leads haven't been followed up? Who's responsible?"
 *
 * Uses `/getLeadReminder` as the source of truth — the backend returns
 * only pending reminders (status=0) and groups them into today / due
 * (overdue) / upcoming buckets.
 */
import { z } from "zod";

import { leadsPost } from "../../../../helpers/leads.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  form_id: z
    .number()
    .int()
    .positive()
    .describe(
      "The form ID to scope overdue reminders to. Use list_forms to discover available forms.",
    ),
  min_days_overdue: z
    .number()
    .int()
    .min(0)
    .default(1)
    .describe(
      "Minimum number of days past the follow-up date to include (0 = include anything already past due)",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of overdue reminders to return"),
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

interface ReminderResponse {
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
    title: "Get Overdue Leads",
    description:
      "Lists leads with pending follow-up reminders whose due date has passed. " +
      "Use this to answer: Which leads need immediate attention? Who has " +
      "follow-ups that are 3+ days overdue? Source of truth is pending " +
      "reminders (not a stale follow_up_date on the lead record).",
    inputSchema: schema,
    annotations: { readOnlyHint: true, idempotentHint: true },
    meta: { version: "2.0.0", tags: ["analytics", "leads", "follow-up"] },

    handler: async (input, ctx) => {
      const res = await leadsPost<ReminderResponse>(
        "/getLeadReminder",
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
          stage: r.pipeline_char ?? "unknown",
          assigned_to_name: r.assigned_to_name ?? "Unassigned",
          form_name: r.LeadFormName ?? null,
        });
      }

      overdue.sort((a, b) => b.days_overdue - a.days_overdue);
      const limited = overdue.slice(0, input.limit);

      return {
        total_overdue: overdue.length,
        returned: limited.length,
        overdue: limited,
      };
    },
  };

toolRegistry.register(getOverdueLeadsTool);
