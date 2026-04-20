// AUDIT (v1):
// - Verdict: DEFER (v2)
// - Out of v1 scope: stage changes affect funnel analytics and downstream
//   triggers; needs policy review before LLM exposure.
// - No changes in v1 — existing behavior preserved.

/**
 * Moves a lead to a named stage within its current pipeline.
 *
 * Resolves the human-readable stage name to a pipeline_char index by:
 *   1. Fetching the lead to get its pipeline_id
 *   2. Fetching the pipeline definition to find the matching stage index
 *   3. Calling /updateLeadResponsePipeline with the resolved pipeline_char
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
    .describe("The internal CRM ID of the lead to move"),
  stage_name: z
    .string()
    .min(1)
    .describe(
      "Human-readable name of the target stage, e.g. Qualified, Demo Scheduled, Won. " +
        "Must exactly match a stage defined in the lead's pipeline.",
    ),
});

interface MoveLeadResult {
  success: boolean;
  lead_id: number;
  previous_stage: string;
  new_stage: string;
  pipeline_name: string;
}

interface LeadRecord {
  id?: number;
  pipeline_id?: number;
  pipeline_char?: string;
}

interface LeadByIdResponse {
  data?: LeadRecord;
}

interface PipelineRecord {
  id?: number;
  pipeline_name?: string;
  stages?: string[];
}

interface AllPipelinesResponse {
  data?: PipelineRecord[];
}

interface UpdateResponse {
  success?: boolean;
  message?: string;
}

export const moveLeadToStageTool: ToolDefinition<
  typeof schema,
  MoveLeadResult
> = {
  name: "move_lead_to_stage",
  title: "Move Lead to Stage",
  description:
    "Moves a lead to a different stage within its pipeline. " +
    "Provide the human-readable stage name (e.g. 'Qualified', 'Won') — it will be resolved automatically. " +
    "Use this when you want to advance or update where a lead sits in the sales process.",
  inputSchema: schema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  meta: { version: "1.0.0", tags: ["action", "leads", "pipeline"] },

  handler: async (input, ctx) => {
    // Fetch lead and pipelines in parallel
    const [leadRes, pipelinesRes] = await Promise.all([
      leadsPost<LeadByIdResponse>("/getLeadById", { lead_id: input.lead_id }, ctx),
      leadsPost<AllPipelinesResponse>("/getAllPipelines", {}, ctx),
    ]);

    const lead = leadRes.data;
    if (!lead) {
      throw new Error(`Lead ${input.lead_id} not found`);
    }

    const pipelineId = lead.pipeline_id;
    const previousStage = lead.pipeline_char ?? "unknown";

    if (!pipelineId) {
      throw new Error(`Lead ${input.lead_id} has no associated pipeline`);
    }

    const pipeline = (pipelinesRes.data ?? []).find((p) => p.id === pipelineId);
    if (!pipeline) {
      throw new Error(`Pipeline ${pipelineId} not found`);
    }

    const stages = pipeline.stages ?? [];
    const stageIndex = stages.findIndex(
      (s) => s.toLowerCase() === input.stage_name.toLowerCase(),
    );

    if (stageIndex === -1) {
      throw new Error(
        `Stage "${input.stage_name}" not found in pipeline "${pipeline.pipeline_name ?? pipelineId}". ` +
          `Available stages: ${stages.join(", ")}`,
      );
    }

    // pipeline_char is the string representation of the stage index
    const newPipelineChar = String(stageIndex);

    await leadsPost<UpdateResponse>(
      "/updateLeadResponsePipeline",
      {
        lead_id: input.lead_id,
        pipeline_id: pipelineId,
        pipeline_char: newPipelineChar,
      },
      ctx,
    );

    return {
      success: true,
      lead_id: input.lead_id,
      previous_stage: previousStage,
      new_stage: input.stage_name,
      pipeline_name: pipeline.pipeline_name ?? String(pipelineId),
    };
  },
};

toolRegistry.register(moveLeadToStageTool);
