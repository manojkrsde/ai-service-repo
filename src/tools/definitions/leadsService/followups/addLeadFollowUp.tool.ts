import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  lead_id: z
    .number()
    .int()
    .positive()
    .describe("Lead id to schedule a follow-up against."),
  follow_up_date: z
    .string()
    .describe(
      "Follow-up date/time as an ISO string (e.g. '2026-05-10T15:00:00Z'). Backend stores it on the lead row and the reminders table.",
    ),
});

interface AddLeadFollowUpResult {
  success: boolean;
  lead_id: number;
  message: string;
}

interface BackendMessageItem {
  msg?: string;
  status?: boolean;
}

interface BackendEnvelope {
  message?: BackendMessageItem[] | BackendMessageItem;
}

function pickFirst(env: BackendEnvelope | undefined): BackendMessageItem {
  const m = env?.message;
  if (Array.isArray(m)) return m[0] ?? {};
  if (m && typeof m === "object") return m;
  return {};
}

export const addLeadFollowUpTool: ToolDefinition<
  typeof schema,
  AddLeadFollowUpResult
> = {
  name: "add_lead_followup",
  title: "Schedule a follow-up reminder on a lead",
  description:
    "Schedules a high-priority follow-up reminder against a lead. Required: `lead_id`, " +
    "`follow_up_date`. The backend writes a row to `t_comapnies_lead_calls_reminders`, sets the " +
    "lead's `follow_up_date` column, and logs a FOLLOW_UP_ADDED activity entry tagged to the " +
    "calling user." +
    "\n\nUNDERSTANDING THE FLOW: Append-only — never edits an existing reminder. company_id / " +
    "company_type are auto-injected. After this call the lead will surface in `get_lead_follow_ups` " +
    "(use lead_id and/or filter='overdue' to narrow) based on the date." +
    "\n\nUSE THIS TOOL TO: queue a callback time after a chat with the lead, set a reminder " +
    "after a call, or stage a sequence of follow-ups." +
    "\n\nNOTE: Mark a follow-up done is a destructive operation (`updateLeadFollowUp`) and is " +
    "not exposed via MCP. Pass an ISO timestamp — backends parse YYYY-MM-DD as midnight UTC.",
  inputSchema: schema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  meta: { version: "1.0.0", tags: ["action", "leads", "followups"] },

  handler: async (input, ctx) => {
    const res = await apiPost<BackendEnvelope>(
      `${SERVICE.LEADS}/addLeadFollowUp`,
      {
        lead_id: input.lead_id,
        follow_up_date: input.follow_up_date,
      },
      ctx,
    );

    const first = pickFirst(res);

    return {
      success: first.status !== false,
      lead_id: input.lead_id,
      message: first.msg ?? "Follow Up Created Successfully",
    };
  },
};

toolRegistry.register(addLeadFollowUpTool);
