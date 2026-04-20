/**
 * Returns all pipelines with their stage names.
 *
 * Useful as a discovery call before using move_lead_to_stage or
 * get_pipeline_funnel — the admin needs to know pipeline IDs and stage names.
 */
import { z } from "zod";

import { leadsPost } from "../../../../helpers/leads.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  type: z
    .enum(["lead", "deal"])
    .default("lead")
    .describe('Return lead pipelines or deal pipelines (default: "lead")'),
});

interface PipelineSummary {
  id: number;
  name: string;
  type: string;
  stages: string[];
}

interface ListPipelinesResult {
  pipelines: PipelineSummary[];
}

interface PipelineRecord {
  id?: number;
  pipeline_name?: string;
  type?: string;
  stages?: string[];
}

interface AllPipelinesResponse {
  data?: PipelineRecord[];
}

export const listPipelinesTool: ToolDefinition<
  typeof schema,
  ListPipelinesResult
> = {
  name: "list_pipelines",
  title: "List Pipelines",
  description:
    "Returns all pipelines configured for the company, with their stage names in order. " +
    "Use this before calling get_pipeline_funnel or move_lead_to_stage to discover " +
    "pipeline IDs and the exact stage names you can use.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["config", "pipeline"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {};
    if (input.type) body["type"] = input.type;

    const res = await leadsPost<AllPipelinesResponse>(
      "/getAllPipelines",
      body,
      ctx,
    );

    const pipelines: PipelineSummary[] = (res.data ?? []).map((p) => ({
      id: p.id ?? 0,
      name: p.pipeline_name ?? `Pipeline ${p.id ?? "?"}`,
      type: p.type ?? input.type,
      stages: p.stages ?? [],
    }));

    return { pipelines };
  },
};

toolRegistry.register(listPipelinesTool);
