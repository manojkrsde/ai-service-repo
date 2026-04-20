/**
 * Answers: "Do we have a lead for [email]?"
 *
 * Backend's `/getAllLeadsResponse` `search_text` does an iLike match on
 * email OR mobile — so an email string works directly.
 */
import { z } from "zod";

import {
  createEnrichmentCache,
  enrichLeads,
  type EnrichedLead,
  type LeadLike,
} from "../../../../helpers/lead-enrichment.helper.js";
import { leadsPost } from "../../../../helpers/leads.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  email: z
    .string()
    .min(3)
    .describe("Email or partial email to search for"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of matching leads to return"),
});

interface EmailSearchResult {
  query: string;
  total_matches: number;
  matches: EnrichedLead[];
  disambiguation_hint: string | null;
}

interface LeadRecord extends LeadLike {
  id?: number;
}

interface AllLeadsResponse {
  data?: LeadRecord[];
  total_count?: number;
}

export const searchLeadByEmailTool: ToolDefinition<
  typeof schema,
  EmailSearchResult
> = {
  name: "search_lead_by_email",
  title: "Search Lead by Email",
  description:
    "Finds leads by email address (exact or partial). " +
    "Use when the user asks: Do we have a lead for [email]? " +
    "Find the lead with email [address].",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["search", "leads"] },

  handler: async (input, ctx) => {
    const res = await leadsPost<AllLeadsResponse>(
      "/getAllLeadsResponse",
      {
        search_text: input.email,
        limit: input.limit,
        offset: 0,
      },
      ctx,
    );

    const leads = res.data ?? [];
    const enriched = await enrichLeads(leads, ctx, createEnrichmentCache());

    const hint =
      enriched.length > 1
        ? "Multiple leads match this email — ask the user which one they mean."
        : null;

    return {
      query: input.email,
      total_matches: enriched.length,
      matches: enriched,
      disambiguation_hint: hint,
    };
  },
};

toolRegistry.register(searchLeadByEmailTool);
