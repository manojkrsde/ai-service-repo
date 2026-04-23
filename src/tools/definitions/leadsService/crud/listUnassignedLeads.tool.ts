/**
 * Answers: "Which leads are unassigned?"
 *
 * Wraps `/getAllQueueLeadsResponse`. For non-admin callers the backend
 * returns nothing (they only see their own assigned leads), which is the
 * correct information-safe outcome — we surface that via `access_note`.
 */
import { z } from "zod";

import {
  createEnrichmentCache,
  enrichLeads,
  type EnrichedLead,
  type LeadLike,
} from "../_shared/enrichment.js";
import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  form_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Scope to a specific form (optional)"),
  pipeline_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Scope to a specific pipeline (optional)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Number of results to return"),
  offset: z.number().int().min(0).default(0).describe("Pagination offset"),
});

interface UnassignedResult {
  total_count: number;
  returned: number;
  leads: EnrichedLead[];
  access_note: string | null;
}

interface LeadRecord extends LeadLike {
  id?: number;
}
interface QueueLeadsResponse {
  data?: LeadRecord[];
  total_count?: number;
}

export const listUnassignedLeadsTool: ToolDefinition<
  typeof schema,
  UnassignedResult
> = {
  name: "list_unassigned_leads",
  title: "List Unassigned Leads",
  description:
    "Lists leads waiting in the queue (assigned_to is null). Admins see the " +
    "full queue; non-admins see only leads they can act on (typically none, " +
    "which is correct). " +
    "Use when the user asks: Show unassigned leads. What's in the queue?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leads", "queue"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      limit: input.limit,
      offset: input.offset,
    };
    if (input.form_id !== undefined) body["form_id"] = input.form_id;
    if (input.pipeline_id !== undefined)
      body["pipeline_id"] = input.pipeline_id;

    const res = await apiPost<QueueLeadsResponse>(`${SERVICE.LEADS}/getAllQueueLeadsResponse`,
      body,
      ctx,
    );

    const leads = res.data ?? [];
    const enriched = await enrichLeads(leads, ctx, createEnrichmentCache());

    const role = ctx.sessionAuth?.role;
    const isAdmin = role === "admin" || role === "super-admin";
    const accessNote =
      !isAdmin && enriched.length === 0
        ? "Unassigned leads are only visible to admins. Your role returns an empty queue by design."
        : null;

    return {
      total_count: res.total_count ?? enriched.length,
      returned: enriched.length,
      leads: enriched,
      access_note: accessNote,
    };
  },
};

toolRegistry.register(listUnassignedLeadsTool);
