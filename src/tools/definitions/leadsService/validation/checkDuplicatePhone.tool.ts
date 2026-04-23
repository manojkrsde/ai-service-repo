/**
 * Answers: "Do we already have a lead for phone [X]?"
 *
 * Client-side phone normalisation + `/checkDuplcateLeadByNumber`.
 * Lighter than `search_lead_by_phone` — returns just the minimum needed
 * to decide whether a duplicate exists.
 */
import { z } from "zod";

import {
  createEnrichmentCache,
  enrichLeads,
  type EnrichedLead,
  type LeadLike,
} from "../_shared/enrichment.js";
import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import { normalizePhone } from "../../../../helpers/phone.helper.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  phone: z
    .string()
    .min(3)
    .describe("Phone number in any format to check for duplicates"),
});

interface DuplicateCheckResult {
  query: string;
  normalized: { digits: string; last10: string };
  exists: boolean;
  match_count: number;
  existing_leads: EnrichedLead[];
}

interface LeadRecord extends LeadLike {
  id?: number;
}

interface DuplicateResponse {
  data?: LeadRecord[] | LeadRecord | null;
  message?: string;
}

function collect(res: DuplicateResponse): LeadRecord[] {
  if (!res.data) return [];
  if (Array.isArray(res.data)) return res.data;
  return [res.data];
}

export const checkDuplicatePhoneTool: ToolDefinition<
  typeof schema,
  DuplicateCheckResult
> = {
  name: "check_duplicate_phone",
  title: "Check Duplicate Phone",
  description:
    "Checks whether a phone number already has a lead record. Use before " +
    "recommending lead creation, or to answer: Do we already have this number?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leads", "duplicate-check"] },

  handler: async (input, ctx) => {
    const normalized = normalizePhone(input.phone);
    const key = normalized.last10 || normalized.digits;

    const res = await apiPost<DuplicateResponse>(`${SERVICE.LEADS}/checkDuplcateLeadByNumber`,
      { mobile_no: key },
      ctx,
    );

    const matches = collect(res);
    const enriched = await enrichLeads(matches, ctx, createEnrichmentCache());

    return {
      query: input.phone,
      normalized: { digits: normalized.digits, last10: normalized.last10 },
      exists: enriched.length > 0,
      match_count: enriched.length,
      existing_leads: enriched,
    };
  },
};

toolRegistry.register(checkDuplicatePhoneTool);
