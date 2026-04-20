// AUDIT (v1):
// - Verdict: KEEP
// - Thin, correct wrapper on `/getOverallStageCounts`.
// - Lighter alternative to `get_pipeline_funnel` — no drop-off math.

/**
 * Answers: "How many leads are in each stage? What's the pipeline breakdown?"
 *
 * Calls /getOverallStageCounts for a quick stage-by-stage count.
 * Lighter than get_pipeline_funnel — no drop-off math, just raw counts.
 */
import { z } from "zod";

import { leadsPost } from "../../../../helpers/leads.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  form_id: z
    .number()
    .int()
    .positive()
    .describe(
      "The form ID to get stage counts for. Use list_forms to discover available forms.",
    ),
  user_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Scope counts to a specific user's leads (optional — omit for all users)",
    ),
  source: z
    .string()
    .optional()
    .describe(
      "Filter by lead source, e.g. facebook, whatsapp, manual (optional)",
    ),
});

interface OverallStageCountsResult {
  form_id: number;
  stage_counts: Record<string, number>;
  total: number;
}

interface StageCountsResponse {
  data?: {
    overallStageCounts?: Record<string, number>;
  };
}

export const getOverallStageCountsTool: ToolDefinition<
  typeof schema,
  OverallStageCountsResult
> = {
  name: "get_overall_stage_counts",
  title: "Get Overall Stage Counts",
  description:
    "Returns the number of leads at each pipeline stage for a specific form. " +
    "Faster and lighter than get_pipeline_funnel when you just need raw counts without drop-off analysis. " +
    "Use this to answer: How many leads are in each stage? What's the breakdown of our pipeline? " +
    "How many leads are in the Demo stage?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["analytics", "pipeline", "leads"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      form_id: input.form_id,
    };

    if (input.user_id !== undefined) body["user_id"] = input.user_id;
    if (input.source) body["parent_source"] = input.source;

    const res = await leadsPost<StageCountsResponse>(
      "/getOverallStageCounts",
      body,
      ctx,
    );

    const stageCounts = res.data?.overallStageCounts ?? {};
    const total = Object.values(stageCounts).reduce((sum, n) => sum + n, 0);

    return {
      form_id: input.form_id,
      stage_counts: stageCounts,
      total,
    };
  },
};

toolRegistry.register(getOverallStageCountsTool);
