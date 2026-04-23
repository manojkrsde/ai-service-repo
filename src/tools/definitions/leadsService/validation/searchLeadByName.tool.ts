/**
 * Answers: "Find the lead named [X]."
 *
 * Names live in the `response` JSONB field and are not indexed by the
 * backend's search. Strategy: bounded fetch (default 200, max 500)
 * optionally narrowed by `form_id`, then in-memory fuzzy ranking via
 * token match + Levenshtein.
 */
import { z } from "zod";

import {
  createEnrichmentCache,
  enrichLeads,
  type EnrichedLead,
  type LeadLike,
} from "../_shared/enrichment.js";
import { extractLeadName } from "../_shared/lead.helpers.js";
import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import { rankByName } from "../../../../helpers/fuzzy-name.helper.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const DEFAULT_FETCH = 200;
const MAX_FETCH = 500;

const schema = z.object({
  name: z.string().min(2).describe("Name (or partial name) to search for"),
  form_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Narrow the search to a single form — strongly recommended for large databases",
    ),
  fetch_size: z
    .number()
    .int()
    .min(50)
    .max(MAX_FETCH)
    .default(DEFAULT_FETCH)
    .describe(
      `How many leads to scan for ranking (default ${DEFAULT_FETCH}, max ${MAX_FETCH})`,
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of ranked matches to return"),
  min_score: z
    .number()
    .min(0)
    .max(1)
    .default(0.4)
    .describe("Minimum fuzzy-match score (0..1) to include a match"),
});

interface ScoredMatch extends EnrichedLead {
  score: number;
}

interface NameSearchResult {
  query: string;
  total_scanned: number;
  total_matches: number;
  matches: ScoredMatch[];
  cap_hit: boolean;
  cap_hit_hint: string | null;
}

interface LeadRecord extends LeadLike {
  id?: number;
}

interface AllLeadsResponse {
  data?: LeadRecord[];
  total_count?: number;
}

export const searchLeadByNameTool: ToolDefinition<
  typeof schema,
  NameSearchResult
> = {
  name: "search_lead_by_name",
  title: "Search Lead by Name",
  description:
    "Finds leads by fuzzy name match (handles typos, partial names, different orderings). " +
    "Names are stored in the lead's form response, so this tool scans a bounded page " +
    "and ranks in-memory. Pass form_id to narrow the scan in large databases. " +
    "Use when the user asks: Find the lead named [name]. Is there a lead for [person]?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["search", "leads"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      limit: input.fetch_size,
      offset: 0,
    };
    if (input.form_id !== undefined) body["form_id"] = input.form_id;

    const res = await apiPost<AllLeadsResponse>(`${SERVICE.LEADS}/getAllLeadsResponse`,
      body,
      ctx,
    );

    const leads = res.data ?? [];
    const totalScanned = leads.length;
    const capHit = totalScanned >= input.fetch_size;

    const ranked = rankByName(
      input.name,
      leads,
      (l) =>
        extractLeadName({
          ...(typeof l.email === "string" ? { email: l.email } : {}),
          ...(typeof l.mobile_no === "string"
            ? { mobile_no: l.mobile_no }
            : {}),
          ...(l.response ? { response: l.response } : {}),
        }),
      input.min_score,
    ).slice(0, input.limit);

    const cache = createEnrichmentCache();
    const enriched = await enrichLeads(
      ranked.map((r) => r.item),
      ctx,
      cache,
    );

    const matches: ScoredMatch[] = enriched.map((e, i) => ({
      ...e,
      score: ranked[i]?.score ?? 0,
    }));

    const capHitHint = capHit
      ? "Reached the scan cap — there may be more leads matching this name. Narrow by form_id or phone to find them."
      : null;

    return {
      query: input.name,
      total_scanned: totalScanned,
      total_matches: matches.length,
      matches,
      cap_hit: capHit,
      cap_hit_hint: capHitHint,
    };
  },
};

toolRegistry.register(searchLeadByNameTool);
