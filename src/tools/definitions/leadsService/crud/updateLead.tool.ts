/**
 * Updates mutable fields on an existing lead record.
 *
 * Accepts a partial patch — only supplied fields are sent to the backend.
 * Calls /updateLeadResponse with the lead_id and changed fields.
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
    .describe("The internal CRM ID of the lead to update"),
  priority: z
    .enum(["low", "medium", "high", "urgent"])
    .optional()
    .describe("New priority level for the lead"),
  follow_up_date: z
    .string()
    .optional()
    .describe("New follow-up date (ISO date or datetime string)"),
  fields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Partial update to the lead's form response fields"),
});

interface UpdateLeadResult {
  success: boolean;
  lead_id: number;
  updated_fields: string[];
}

interface UpdateResponse {
  success?: boolean;
  message?: string;
}

export const updateLeadTool: ToolDefinition<typeof schema, UpdateLeadResult> =
  {
    name: "update_lead",
    title: "Update Lead",
    description:
      "Updates mutable fields on a lead record (priority, follow-up date, form fields). " +
      "Only the fields you supply are changed. " +
      "Use when the user says: Change lead 123's priority to urgent. " +
      "Update the follow-up date for this lead.",
    inputSchema: schema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    meta: { version: "1.0.0", tags: ["action", "leads"] },

    handler: async (input, ctx) => {
      const body: Record<string, unknown> = { lead_id: input.lead_id };
      const updatedFields: string[] = [];

      if (input.priority !== undefined) {
        body["priority"] = input.priority;
        updatedFields.push("priority");
      }
      if (input.follow_up_date !== undefined) {
        body["follow_up_date"] = input.follow_up_date;
        updatedFields.push("follow_up_date");
      }
      if (input.fields !== undefined) {
        body["response"] = input.fields;
        updatedFields.push(...Object.keys(input.fields));
      }

      await leadsPost<UpdateResponse>("/updateLeadResponse", body, ctx);

      return {
        success: true,
        lead_id: input.lead_id,
        updated_fields: updatedFields,
      };
    },
  };

toolRegistry.register(updateLeadTool);
