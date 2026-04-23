// AUDIT (v1):
// - Verdict: KEEP (minor polish)
// - Low-risk additive mutation; outcome mapping is correct.
// - Polish: expanded description makes the optional reminder side-effect
//   explicit so callers know `follow_up_in_days` creates a reminder row.

/**
 * Logs a phone call interaction against a lead.
 *
 * Maps the intent-friendly "outcome" enum to the backend's call_type_status strings.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const OUTCOME_MAP: Record<string, string> = {
  connected: "Outgoing Call",
  missed: "Missed Call",
  busy: "Busy",
  voicemail: "Voicemail",
};

const schema = z.object({
  lead_id: z
    .number()
    .int()
    .positive()
    .describe("The internal CRM ID of the lead the call was for"),
  outcome: z
    .enum(["connected", "missed", "busy", "voicemail"])
    .describe(
      "What happened on the call: connected (you spoke), missed, busy, or voicemail",
    ),
  notes: z
    .string()
    .optional()
    .describe("Any notes about the call — what was discussed, next steps, etc."),
  follow_up_in_days: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe(
      "If a follow-up is needed, how many days from today to schedule it (optional)",
    ),
});

interface LogCallResult {
  success: boolean;
  lead_id: number;
  call_id: number | null;
  follow_up_date: string | null;
}

interface CallResponse {
  success?: boolean;
  data?: { id?: number };
  id?: number;
}

export const logCallForLeadTool: ToolDefinition<typeof schema, LogCallResult> =
  {
    name: "log_call_for_lead",
    title: "Log Call for Lead",
    description:
      "Records a phone call interaction against a lead. " +
      "Use this after speaking with (or attempting to reach) a lead. " +
      "Provide the outcome and any notes. Optionally schedule a follow-up.",
    inputSchema: schema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    meta: { version: "1.0.0", tags: ["action", "leads", "calls"] },

    handler: async (input, ctx) => {
      const today = new Date();
      const callDate = today.toISOString().slice(0, 10);

      let followUpDate: string | null = null;
      if (input.follow_up_in_days !== undefined) {
        const fu = new Date(today);
        fu.setDate(today.getDate() + input.follow_up_in_days);
        followUpDate = fu.toISOString().slice(0, 10);
      }

      const callTypeStatus = OUTCOME_MAP[input.outcome] ?? "Outgoing Call";

      const body: Record<string, unknown> = {
        lead_id: input.lead_id,
        call_type_status: callTypeStatus,
        call_date: callDate,
      };

      if (input.notes) body["note"] = input.notes;
      if (followUpDate) body["follow_up_date"] = followUpDate;

      const res = await apiPost<CallResponse>(`${SERVICE.LEADS}/addLeadCalls`, body, ctx);

      const callId = res.data?.id ?? res.id ?? null;

      return {
        success: true,
        lead_id: input.lead_id,
        call_id: callId !== undefined ? callId : null,
        follow_up_date: followUpDate,
      };
    },
  };

toolRegistry.register(logCallForLeadTool);
