// AUDIT (v1):
// - Verdict: DEFER (v2)
// - Out of v1 scope: reassignment is a higher-risk mutation that should
//   get review + policy guard-rails before LLM exposure.
// - No changes in v1 — existing behavior preserved.

/**
 * Assigns a lead to a specific user.
 *
 * Calls /assignLead (assignLeadManually controller).
 * Backend reads: req.body.leadId (the lead) and req.body.id (the user to assign to).
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

// interface LeadRecord {
//   id?: number;
//   form_id?: number;
// }

// interface LeadByIdResponse {
//   data?: LeadRecord;
// }

interface AssignResponse {
  success?: boolean;
  msg?: string;
  status?: boolean;
}

export const assignLeadTool: ToolDefinition<typeof schema, AssignLeadResult> = {
  name: "assign_lead",
  title: "Assign Lead",
  description:
    "Manually assigns a lead to a specific CRM user (salesperson/agent). " +
    "Use list_employees to discover user IDs and names. " +
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
    // Backend assignLeadManually reads:
    //  - leadId: the lead's PK
    //  - id: the user to assign to
    await leadsPost<AssignResponse>(
      "/assignLead",
      {
        leadId: input.lead_id,
        id: input.user_id,
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
