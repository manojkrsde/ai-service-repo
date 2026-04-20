// AUDIT (v1):
// - Verdict: KEEP (minor polish)
// - Low-risk additive mutation.
// - Polish: surface the created reminder's id in the response so callers
//   can chain into mark_reminder_done.

/**
 * Schedules a follow-up reminder for a specific lead.
 *
 * Calls /addLeadFollowUp to create a new reminder record.
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
    .describe("The internal CRM ID of the lead to schedule a follow-up for"),
  follow_up_date: z
    .string()
    .min(1)
    .describe(
      "When to follow up, as an ISO date or datetime string (e.g. 2026-04-17 or 2026-04-17T10:00:00Z)",
    ),
});

interface AddFollowUpResult {
  success: boolean;
  lead_id: number;
  follow_up_date: string;
  reminder_id: number | null;
}

interface FollowUpResponse {
  success?: boolean;
  data?: { id?: number };
  id?: number;
  message?: string;
}

export const addLeadFollowUpTool: ToolDefinition<
  typeof schema,
  AddFollowUpResult
> = {
  name: "add_lead_follow_up",
  title: "Add Lead Follow-Up",
  description:
    "Schedules a follow-up reminder for a lead at a specific date and time. " +
    "Use this when the user says: Remind me to call lead 123 tomorrow at 10am. " +
    "Schedule a follow-up for next Monday. Set a reminder to check in with this lead.",
  inputSchema: schema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  meta: { version: "1.0.0", tags: ["action", "leads", "follow-up"] },

  handler: async (input, ctx) => {
    const res = await leadsPost<FollowUpResponse>(
      "/addLeadFollowUp",
      {
        lead_id: input.lead_id,
        follow_up_date: input.follow_up_date,
      },
      ctx,
    );

    const reminderId = res.data?.id ?? res.id ?? null;

    return {
      success: true,
      lead_id: input.lead_id,
      follow_up_date: input.follow_up_date,
      reminder_id: reminderId,
    };
  },
};

toolRegistry.register(addLeadFollowUpTool);
