/**
 * Returns the chronological activity timeline for a single lead.
 *
 * Wraps POST /getLeadActivities. Backend middleware is strict — it accepts
 * only signature + lead_id, so company context is suppressed. Backend
 * pre-groups results by date (groupByDateAndType) merging call logs and
 * lead_activities rows (notes added, stage changes, follow-ups, priority
 * changes, etc.). The shape is opaque enough that we surface it as `groups`
 * for the LLM to render directly.
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
    .describe("The internal CRM ID of the lead whose timeline to fetch."),
});

interface ActivityResult {
  lead_id: number;
  groups: unknown;
}

interface ActivityResponse {
  data: {
    data: unknown;
  };
}

export const getLeadActivityTool: ToolDefinition<typeof schema, ActivityResult> =
  {
    name: "get_lead_activity",
    title:
      "Get lead activity timeline — calls + notes + stage changes grouped by date",
    description:
      "Returns the merged activity timeline for one lead — call logs, notes, follow-up " +
      "creations, stage changes, and priority changes — grouped server-side by date and event " +
      "type. Each group is a date bucket containing items with createdAt, title, description, " +
      "icon, color, and the actor (`acitivityBy: { name, image }`). " +
      "\n\nUNDERSTANDING THE FLOW: Activity entries are written automatically by other tools " +
      "(log_call_for_lead, add_note_to_lead, update_lead, move_lead_to_stage). They cannot be " +
      "edited or deleted from this surface. The shape of `groups` is opaque (backend renders " +
      "it for the dashboard) — surface it to the user as a chronological feed. " +
      "\n\nUSE THIS TOOL TO: build a 'what's happened on lead X' view, audit a single lead's " +
      "history, or pull the activity feed for narration. For the lead profile + activity in one " +
      "call, use get_lead_details (which already returns this and notes/calls in parallel).",
    inputSchema: schema,
    annotations: { readOnlyHint: true, idempotentHint: true },
    meta: { version: "2.0.0", tags: ["leads", "activity"] },

    handler: async (input, ctx) => {
      const res = await apiPost<ActivityResponse>(
        `${SERVICE.LEADS}/getLeadActivities`,
        { lead_id: input.lead_id },
        ctx,
        { injectCompanyContext: false },
      );

      return {
        lead_id: input.lead_id,
        groups: res.data?.data ?? [],
      };
    },
  };

toolRegistry.register(getLeadActivityTool);
