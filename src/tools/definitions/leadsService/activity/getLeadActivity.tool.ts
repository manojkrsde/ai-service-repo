/**
 * Answers: "What's happened on lead [ID]? Show me the activity log."
 *
 * Dedicated wrapper on `/getLeadActivities` — faster for the LLM than
 * pulling full details via `get_lead_details` when only the timeline
 * is needed.
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
    .describe("The internal CRM ID of the lead whose activity to fetch"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe("Maximum number of activity entries to return (most recent first)"),
});

interface ActivityEntry {
  id: number;
  activity: string;
  description: string;
  activity_type: string;
  created_at: string;
  created_by: number | null;
  created_by_name: string;
}

interface ActivityResult {
  lead_id: number;
  total_activities: number;
  returned: number;
  activities: ActivityEntry[];
}

interface RawActivity {
  id?: number;
  activity?: string;
  description?: string;
  activity_type?: string;
  created_at?: string;
  created_by?: number | null;
  created_by_name?: string;
}

interface ActivityResponse {
  data?: RawActivity[];
}

export const getLeadActivityTool: ToolDefinition<
  typeof schema,
  ActivityResult
> = {
  name: "get_lead_activity",
  title: "Get Lead Activity",
  description:
    "Returns the chronological activity log for a single lead — stage changes, " +
    "assignments, notes, calls, and other tracked events. " +
    "Use when the user asks: What happened to lead [X]? Show me the activity on this lead.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leads", "activity"] },

  handler: async (input, ctx) => {
    const res = await leadsPost<ActivityResponse>(
      "/getLeadActivities",
      { lead_id: input.lead_id },
      ctx,
    );

    const raw = res.data ?? [];
    const mapped: ActivityEntry[] = raw.map((a) => ({
      id: a.id ?? 0,
      activity: a.activity ?? "",
      description: a.description ?? "",
      activity_type: a.activity_type ?? "unknown",
      created_at: a.created_at ?? "",
      created_by: a.created_by ?? null,
      created_by_name: a.created_by_name ?? "Unknown",
    }));

    mapped.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const limited = mapped.slice(0, input.limit);

    return {
      lead_id: input.lead_id,
      total_activities: mapped.length,
      returned: limited.length,
      activities: limited,
    };
  },
};

toolRegistry.register(getLeadActivityTool);
