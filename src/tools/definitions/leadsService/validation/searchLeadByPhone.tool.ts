/**
 * Answers: "Do we have a lead for phone number [X]?"
 *
 * Normalises the input phone into digits + country-code variants and
 * searches via `/checkDuplcateLeadByNumber` (primary) and
 * `/getAllLeadsResponse` (fallback/multi-match) using the last-10 digits.
 */
import { z } from "zod";

import {
  createEnrichmentCache,
  enrichLeads,
  type EnrichedLead,
  type LeadLike,
} from "../../../../helpers/lead-enrichment.helper.js";
import { leadsPost } from "../../../../helpers/leads.client.js";
import { normalizePhone } from "../../../../helpers/phone.helper.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  phone: z
    .string()
    .min(3)
    .describe(
      "Phone number in any format — with or without country code, spaces, or leading zero",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Maximum number of matching leads to return"),
});

interface PhoneSearchResult {
  query: string;
  normalized: { digits: string; last10: string };
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

interface DuplicateResponse {
  data?: LeadRecord[] | LeadRecord | null;
  message?: string;
}

function collectFromDuplicate(res: DuplicateResponse): LeadRecord[] {
  if (!res.data) return [];
  if (Array.isArray(res.data)) return res.data;
  return [res.data];
}

function dedupeById(leads: LeadRecord[]): LeadRecord[] {
  const seen = new Set<number>();
  const out: LeadRecord[] = [];
  for (const l of leads) {
    const id = l.id;
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    out.push(l);
  }
  return out;
}

export const searchLeadByPhoneTool: ToolDefinition<
  typeof schema,
  PhoneSearchResult
> = {
  name: "search_lead_by_phone",
  title: "Search Lead by Phone",
  description:
    "Finds leads by phone number with smart normalisation. Accepts any " +
    "format (+91 9876543210, 09876543210, 9876543210, 98765 43210) and " +
    "matches the underlying record regardless of how the number was stored. " +
    "Use when the user asks: Do we have a lead for [number]? Who called from [number]?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["search", "leads"] },

  handler: async (input, ctx) => {
    const normalized = normalizePhone(input.phone);
    const collected: LeadRecord[] = [];

    try {
      const dup = await leadsPost<DuplicateResponse>(
        "/checkDuplcateLeadByNumber",
        { mobile_no: normalized.last10 || normalized.digits },
        ctx,
      );
      collected.push(...collectFromDuplicate(dup));
    } catch {
      // degrade to the list endpoint
    }

    if (normalized.last10) {
      try {
        const list = await leadsPost<AllLeadsResponse>(
          "/getAllLeadsResponse",
          {
            search_text: normalized.last10,
            limit: input.limit,
            offset: 0,
          },
          ctx,
        );
        collected.push(...(list.data ?? []));
      } catch {
        // already have duplicate-endpoint results, if any
      }
    }

    const unique = dedupeById(collected).slice(0, input.limit);
    const enriched = await enrichLeads(unique, ctx, createEnrichmentCache());

    const hint =
      enriched.length > 1
        ? "Multiple leads share this phone number — show the user the list so they can pick one by lead_id or form_name."
        : null;

    return {
      query: input.phone,
      normalized: { digits: normalized.digits, last10: normalized.last10 },
      total_matches: enriched.length,
      matches: enriched,
      disambiguation_hint: hint,
    };
  },
};

toolRegistry.register(searchLeadByPhoneTool);
