/**
 * Updates mutable fields on an existing lead record.
 *
 * Routes different update types to the correct backend endpoints:
 *   - priority change  →  POST /updateLeadPriority
 *   - field/date update →  POST /editLeadResponse
 *
 * NOTE: Stage changes should use move_lead_to_stage instead.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  lead_id: z
    .number()
    .int()
    .positive()
    .describe("The internal CRM ID of the lead to update"),
  priority: z
    .enum(["Low", "Medium", "High", "Urgent"])
    .optional()
    .describe(
      "New priority level for the lead. If provided, calls /updateLeadPriority.",
    ),
  follow_up_date: z
    .string()
    .optional()
    .describe(
      "New follow-up date as ISO date string (e.g. 2026-05-01). Calls /editLeadResponse.",
    ),
  fields: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Partial update to the lead's form response fields. Calls /editLeadResponse.",
    ),
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
      "Updates mutable fields on a lead record. " +
      "Priority changes use /updateLeadPriority. " +
      "Field/follow-up-date updates use /editLeadResponse. " +
      "For stage changes, use move_lead_to_stage instead. " +
      "Use when the user says: Change lead 123's priority to High. " +
      "Update the follow-up date. Edit this lead's contact details.",
    inputSchema: schema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    meta: { version: "2.0.0", tags: ["action", "leads"] },

    handler: async (input, ctx) => {
      const updatedFields: string[] = [];
      const calls: Promise<unknown>[] = [];

      // Priority update goes through a dedicated endpoint
      if (input.priority !== undefined) {
        calls.push(
          apiPost<UpdateResponse>(`${SERVICE.LEADS}/updateLeadPriority`,
            { lead_id: input.lead_id, priority: input.priority },
            ctx,
          ),
        );
        updatedFields.push("priority");
      }

      // Field and follow-up updates go through editLeadResponse
      if (input.follow_up_date !== undefined || input.fields !== undefined) {
        const body: Record<string, unknown> = { lead_id: input.lead_id };
        if (input.follow_up_date !== undefined) {
          body["follow_up_date"] = input.follow_up_date;
          updatedFields.push("follow_up_date");
        }
        if (input.fields !== undefined) {
          body["response"] = input.fields;
          updatedFields.push(...Object.keys(input.fields));
        }
        calls.push(apiPost<UpdateResponse>(`${SERVICE.LEADS}/editLeadResponse`, body, ctx));
      }

      if (calls.length === 0) {
        throw new Error(
          "No fields to update — provide at least one of: priority, follow_up_date, fields",
        );
      }

      await Promise.all(calls);

      return {
        success: true,
        lead_id: input.lead_id,
        updated_fields: updatedFields,
      };
    },
  };

toolRegistry.register(updateLeadTool);
