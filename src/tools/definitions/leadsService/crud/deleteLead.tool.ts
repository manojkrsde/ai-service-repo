/**
 * Soft-deletes a lead record (marks it inactive).
 *
 * Calls /deleteLeadResponse. The lead is not permanently removed;
 * it is archived and excluded from active lists.
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
    .describe("The internal CRM ID of the lead to delete"),
  reason: z
    .string()
    .optional()
    .describe("Optional reason for deletion (for audit trail)"),
});

interface DeleteLeadResult {
  success: boolean;
  lead_id: number;
}

interface DeleteResponse {
  success?: boolean;
  message?: string;
}

export const deleteLeadTool: ToolDefinition<typeof schema, DeleteLeadResult> =
  {
    name: "delete_lead",
    title: "Delete Lead",
    description:
      "Soft-deletes (archives) a lead record so it no longer appears in active lists. " +
      "The lead is not permanently removed. " +
      "Use when the user says: Remove lead 123. Archive this lead. Delete the duplicate entry.",
    inputSchema: schema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    meta: { version: "1.0.0", tags: ["action", "leads"] },

    handler: async (input, ctx) => {
      const body: Record<string, unknown> = { lead_id: input.lead_id };
      if (input.reason) body["reason"] = input.reason;

      await leadsPost<DeleteResponse>("/deleteLeadResponse", body, ctx);

      return {
        success: true,
        lead_id: input.lead_id,
      };
    },
  };

toolRegistry.register(deleteLeadTool);
