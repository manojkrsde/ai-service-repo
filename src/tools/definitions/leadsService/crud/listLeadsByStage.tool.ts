/**
 * Answers: "Show me all leads in [stage name] of [pipeline]."
 *
 * Resolves stage name to `pipeline_char` via the pipeline definition,
 * then delegates to `/getAllLeadsResponse`.
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
  pipeline_id: z
    .number()
    .int()
    .positive()
    .describe("The pipeline ID whose stage you want to filter on"),
  stage: z
    .string()
    .min(1)
    .describe(
      "Stage name (case-insensitive). Either the human-readable name or the pipeline_char code.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(25)
    .describe("Number of results to return"),
  offset: z
    .number()
    .int()
    .min(0)
    .default(0)
    .describe("Pagination offset"),
});

interface ListByStageResult {
  pipeline_id: number;
  pipeline_name: string | null;
  stage_requested: string;
  stage_resolved: string | null;
  stage_name: string | null;
  total_count: number;
  returned: number;
  leads: EnrichedLead[];
}

interface PipelineStage {
  name?: string;
  char?: string;
  pipeline_char?: string;
}
interface PipelineDefinition {
  id?: number;
  pipeline_name?: string;
  stages?: PipelineStage[];
  pipeline_stages?: PipelineStage[];
}
interface AllPipelinesResponse {
  data?: PipelineDefinition[];
}

interface LeadRecord extends LeadLike {
  id?: number;
}
interface AllLeadsResponse {
  data?: LeadRecord[];
  total_count?: number;
}

function resolveStage(
  pipeline: PipelineDefinition | undefined,
  requested: string,
): { char: string | null; name: string | null } {
  const stages = pipeline?.stages ?? pipeline?.pipeline_stages ?? [];
  const r = requested.trim().toLowerCase();

  for (const s of stages) {
    const sName = (s.name ?? "").trim();
    const sChar = (s.char ?? s.pipeline_char ?? "").trim();
    if (sName.toLowerCase() === r || sChar.toLowerCase() === r) {
      return { char: sChar || null, name: sName || null };
    }
  }
  for (const s of stages) {
    const sName = (s.name ?? "").toLowerCase();
    if (sName.includes(r)) {
      return {
        char: (s.char ?? s.pipeline_char ?? null) as string | null,
        name: s.name ?? null,
      };
    }
  }
  return { char: null, name: null };
}

export const listLeadsByStageTool: ToolDefinition<
  typeof schema,
  ListByStageResult
> = {
  name: "list_leads_by_stage",
  title: "List Leads by Stage",
  description:
    "Lists leads currently in a specific pipeline stage. Resolves the stage name " +
    "to the backend's pipeline_char automatically. " +
    "Use when the user asks: Show me all leads in Qualified. Which leads are in Demo Scheduled?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leads", "list", "pipeline"] },

  handler: async (input, ctx) => {
    const pipelinesRes = await leadsPost<AllPipelinesResponse>(
      "/getAllPipelines",
      {},
      ctx,
    );
    const pipeline = (pipelinesRes.data ?? []).find(
      (p) => p.id === input.pipeline_id,
    );
    const resolved = resolveStage(pipeline, input.stage);
    const stageChar = resolved.char ?? input.stage;

    const leadsRes = await leadsPost<AllLeadsResponse>(
      "/getAllLeadsResponse",
      {
        pipeline_id: input.pipeline_id,
        pipeline_char: stageChar,
        limit: input.limit,
        offset: input.offset,
      },
      ctx,
    );

    const leads = leadsRes.data ?? [];
    const enriched = await enrichLeads(leads, ctx, createEnrichmentCache());

    return {
      pipeline_id: input.pipeline_id,
      pipeline_name: pipeline?.pipeline_name ?? null,
      stage_requested: input.stage,
      stage_resolved: resolved.char,
      stage_name: resolved.name,
      total_count: leadsRes.total_count ?? enriched.length,
      returned: enriched.length,
      leads: enriched,
    };
  },
};

toolRegistry.register(listLeadsByStageTool);
