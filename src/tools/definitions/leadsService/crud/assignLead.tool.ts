// AUDIT (v1):
// - Verdict: DEFER (v2)
// - Out of v1 scope: reassignment is a higher-risk mutation that should
//   get review + policy guard-rails before LLM exposure.
// - No changes in v1 — existing behavior preserved.

/**
 * Assigns a lead to a specific user.
 *
 * Fetches the lead to get its form_id (required by the backend), then calls
 * /assignLead.
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
    .describe("The internal CRM ID of the lead to assign"),
  user_id: z
    .number()
    .int()
    .positive()
    .describe("The user ID to assign the lead to"),
});

interface AssignLeadResult {
  success: boolean;
  lead_id: number;
  assigned_to: number;
}

interface LeadRecord {
  id?: number;
  form_id?: number;
}

interface LeadByIdResponse {
  data?: LeadRecord;
}

interface AssignResponse {
  success?: boolean;
  message?: string;
}

export const assignLeadTool: ToolDefinition<typeof schema, AssignLeadResult> =
  {
    name: "assign_lead",
    title: "Assign Lead",
    description:
      "Manually assigns a lead to a specific CRM user. " +
      "Use this when redistributing leads, responding to a request to hand off a lead, " +
      "or assigning an unattended lead to an agent.",
    inputSchema: schema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    meta: { version: "1.0.0", tags: ["action", "leads", "assignment"] },

    handler: async (input, ctx) => {
      // The backend requires form_id alongside lead_id — fetch it first
      const leadRes = await leadsPost<LeadByIdResponse>(
        "/getLeadById",
        { lead_id: input.lead_id },
        ctx,
      );

      const lead = leadRes.data;
      if (!lead) {
        throw new Error(`Lead ${input.lead_id} not found`);
      }

      const formId = lead.form_id;
      if (!formId) {
        throw new Error(`Lead ${input.lead_id} has no associated form`);
      }

      await leadsPost<AssignResponse>(
        "/assignLead",
        {
          lead_id: input.lead_id,
          assigned_to: input.user_id,
          form_id: formId,
        },
        ctx,
      );

      return {
        success: true,
        lead_id: input.lead_id,
        assigned_to: input.user_id,
      };
    },
  };

toolRegistry.register(assignLeadTool);
