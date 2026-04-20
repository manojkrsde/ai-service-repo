// AUDIT (v1):
// - Verdict: REWRITE
// - Rewritten: always enrich (pipeline_name, form_name, assigned_to_name);
//   always include a short activity summary; expose a richer structured
//   response so the LLM doesn't need follow-up ID lookups.
// - Access: backend auto-scopes `/getLeadById`.

/**
 * Answers: "Tell me about lead [ID] — what's their full history, notes, and calls?"
 *
 * Fetches the lead record and optionally notes, calls, and the activity
 * timeline in parallel, then enriches the lead with human-readable pipeline,
 * form, and assigned-user names.
 */
import { z } from "zod";

import {
  enrichLead,
  createEnrichmentCache,
  type EnrichedLead,
  type LeadLike,
} from "../../../../helpers/lead-enrichment.helper.js";
import { leadsPost } from "../../../../helpers/leads.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  lead_id: z
    .number()
    .int()
    .positive()
    .describe("The internal CRM ID of the lead to retrieve"),
  include: z
    .array(z.enum(["notes", "calls", "activities"]))
    .default(["notes", "calls", "activities"])
    .describe(
      "Which related data to fetch alongside the lead record (all three by default)",
    ),
});

interface NoteEntry {
  id?: number;
  title?: string;
  note?: string;
  created_at?: string;
  created_by_name?: string;
}

interface CallEntry {
  id?: number;
  call_type_status?: string;
  call_date?: string;
  note?: string;
  created_by_name?: string;
}

interface ActivityEntry {
  id?: number;
  activity?: string;
  description?: string;
  activity_type?: string;
  created_at?: string;
  created_by_name?: string;
}

interface LeadDetails {
  lead: EnrichedLead;
  raw_response: Record<string, unknown>;
  notes?: NoteEntry[];
  calls?: CallEntry[];
  activities?: ActivityEntry[];
  activity_summary?: {
    total_notes: number;
    total_calls: number;
    total_activities: number;
    last_activity_at: string | null;
  };
}

interface LeadByIdResponse {
  data?: (LeadLike & { response?: Record<string, unknown> }) | null;
}

interface NotesResponse {
  data?: NoteEntry[];
}
interface CallsResponse {
  data?: CallEntry[];
}
interface ActivitiesResponse {
  data?: ActivityEntry[];
}

export const getLeadDetailsTool: ToolDefinition<typeof schema, LeadDetails> = {
  name: "get_lead_details",
  title: "Get Lead Details",
  description:
    "Retrieves the full profile of a single lead — including pipeline stage, " +
    "assigned user, form name, priority, and optionally notes, call history, " +
    "and activity timeline. Use this when you need the complete picture for a " +
    "specific lead ID. Returns enriched names so no follow-up lookups are needed.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.1.0", tags: ["leads", "lookup"] },

  handler: async (input, ctx) => {
    const body = { lead_id: input.lead_id };

    const [leadRes, notesRes, callsRes, activitiesRes] = await Promise.all([
      leadsPost<LeadByIdResponse>("/getLeadById", body, ctx),
      input.include.includes("notes")
        ? leadsPost<NotesResponse>("/getLeadNote", body, ctx)
        : Promise.resolve<NotesResponse>({ data: [] }),
      input.include.includes("calls")
        ? leadsPost<CallsResponse>("/getLeadCalls", body, ctx)
        : Promise.resolve<CallsResponse>({ data: [] }),
      input.include.includes("activities")
        ? leadsPost<ActivitiesResponse>("/getLeadActivities", body, ctx)
        : Promise.resolve<ActivitiesResponse>({ data: [] }),
    ]);

    const raw = leadRes.data ?? {};
    const cache = createEnrichmentCache();
    const enriched = await enrichLead(raw, ctx, cache);

    const notes = notesRes.data ?? [];
    const calls = callsRes.data ?? [];
    const activities = activitiesRes.data ?? [];

    let lastActivityAt: string | null = null;
    for (const a of activities) {
      if (a.created_at && (!lastActivityAt || a.created_at > lastActivityAt)) {
        lastActivityAt = a.created_at;
      }
    }

    const result: LeadDetails = {
      lead: enriched,
      raw_response: raw.response ?? {},
      activity_summary: {
        total_notes: notes.length,
        total_calls: calls.length,
        total_activities: activities.length,
        last_activity_at: lastActivityAt,
      },
    };

    if (input.include.includes("notes")) result.notes = notes;
    if (input.include.includes("calls")) result.calls = calls;
    if (input.include.includes("activities")) result.activities = activities;

    return result;
  },
};

toolRegistry.register(getLeadDetailsTool);
