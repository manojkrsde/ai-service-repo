/**
 * Soft-archives a lead record (status=0 = inactive).
 *
 * IMPORTANT: There is no /deleteLeadResponse route in the backend.
 * The correct approach is /editLeadResponse with status=0 which marks
 * the lead as inactive and excludes it from all active list queries.
 * The lead data is preserved for audit/recovery.
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
    .describe("The internal CRM ID of the lead to archive/deactivate"),
});

interface DeleteLeadResult {
  success: boolean;
  lead_id: number;
  note: string;
}

interface EditResponse {
  success?: boolean;
  message?: string;
}

export const deleteLeadTool: ToolDefinition<typeof schema, DeleteLeadResult> =
  {
    name: "delete_lead",
    title: "Delete Lead",
    description:
      "Soft-deletes (archives) a lead by setting its status to inactive. " +
      "The lead is NOT permanently removed — it is excluded from active list queries " +
      "but can be restored. Use when the user says: Remove lead 123. " +
      "Archive this lead. Delete the duplicate. Mark this lead as inactive.",
    inputSchema: schema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
    },
    meta: { version: "2.0.0", tags: ["action", "leads"] },

    handler: async (input, ctx) => {
      // Backend has no /deleteLeadResponse route.
      // /editLeadResponse with status=0 achieves the same effect.
      await apiPost<EditResponse>(`${SERVICE.LEADS}/editLeadResponse`,
        { lead_id: input.lead_id, status: 0 },
        ctx,
      );

      return {
        success: true,
        lead_id: input.lead_id,
        note: "Lead archived (status set to inactive). Data is preserved and recoverable.",
      };
    },
  };

toolRegistry.register(deleteLeadTool);
