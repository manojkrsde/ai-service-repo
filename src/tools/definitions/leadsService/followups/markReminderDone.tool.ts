/**
 * Marks a lead reminder as completed (status=1).
 *
 * Wraps `/updateLeadFollowUp`. Backend scopes to caller's accessible
 * leads — non-admins can only complete reminders on their own leads.
 */
import { z } from "zod";

import { leadsPost } from "../../../../helpers/leads.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  reminder_id: z
    .number()
    .int()
    .positive()
    .describe(
      "The reminder ID to mark as done (get this from get_lead_reminders or get_lead_follow_ups)",
    ),
});

interface MarkDoneResult {
  success: boolean;
  reminder_id: number;
}

interface UpdateResponse {
  success?: boolean;
  message?: string;
}

export const markReminderDoneTool: ToolDefinition<
  typeof schema,
  MarkDoneResult
> = {
  name: "mark_reminder_done",
  title: "Mark Reminder Done",
  description:
    "Marks a follow-up reminder as completed. " +
    "Use when the user says: I've done that follow-up. Mark reminder [X] as done. " +
    "Completed the call I was supposed to make.",
  inputSchema: schema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
  },
  meta: { version: "1.0.0", tags: ["action", "leads", "reminders"] },

  handler: async (input, ctx) => {
    // Backend updateFollowUpStatus reads req.body.id (not reminder_id)
    await leadsPost<UpdateResponse>(
      "/updateLeadFollowUp",
      { id: input.reminder_id, status: 1 },
      ctx,
    );

    return {
      success: true,
      reminder_id: input.reminder_id,
    };
  },
};

toolRegistry.register(markReminderDoneTool);
