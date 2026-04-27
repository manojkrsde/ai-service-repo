/**
 * Stage-by-stage lead counts for a single form.
 *
 * Wraps POST /getOverallStageCounts. Backend middleware requires
 * signature + company_id + company_type + form_id; user_id /
 * parent_source / child_source are optional filters. Non-admin callers
 * are auto-scoped to their own leads server-side.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  form_id: z
    .number()
    .int()
    .positive()
    .describe(
      "Lead form ID to count stages for. Use list_forms to discover form IDs.",
    ),
  user_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Filter to one assignee's leads (admin only — non-admin callers are auto-scoped server-side).",
    ),
  source: z
    .string()
    .optional()
    .describe(
      "Filter by parent lead source, e.g. 'facebook', 'whatsapp', 'manual'.",
    ),
  source_child: z
    .string()
    .optional()
    .describe("Filter by child lead source (sub-source under the parent)."),
});

interface StageCountsResult {
  form_id: number;
  total: number;
  stage_counts: Record<string, number>;
}

interface StageCountsResponse {
  data: {
    overallStageCounts: Record<string, number>;
  };
}

export const getOverallStageCountsTool: ToolDefinition<
  typeof schema,
  StageCountsResult
> = {
  name: "get_overall_stage_counts",
  title: "Get overall stage counts — leads-per-stage on a form",
  description:
    "Returns the count of leads currently sitting in each pipeline stage for the given form. " +
    "Output is a flat map { stage_name: count } plus a total. " +
    "\n\nUNDERSTANDING THE FLOW: Every lead has exactly one current stage (`pipeline_char`). " +
    "This tool groups by that field for one form. Non-admin callers are auto-scoped server-side " +
    "to leads they are assigned to. " +
    "\n\nUSE THIS TOOL TO: see the funnel for a single form (how many leads in New / Contacted / " +
    "Demo / Won / Lost), spot-check stage distribution before acting on overdue leads, or " +
    "compute conversion ratios. " +
    "\n\nNOTE: For multi-pipeline / multi-period stats with growth comparisons use " +
    "get_user_lead_stats — its `pipeline_wise_distribution` block covers this in more detail.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "2.0.0", tags: ["analytics", "leads", "pipeline"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = { form_id: input.form_id };
    if (input.user_id !== undefined) body["user_id"] = input.user_id;
    if (input.source) body["parent_source"] = input.source;
    if (input.source_child) body["child_source"] = input.source_child;

    const res = await apiPost<StageCountsResponse>(
      `${SERVICE.LEADS}/getOverallStageCounts`,
      body,
      ctx,
    );

    const stageCounts = res.data?.overallStageCounts ?? {};
    const total = Object.values(stageCounts).reduce((s, n) => s + n, 0);

    return {
      form_id: input.form_id,
      total,
      stage_counts: stageCounts,
    };
  },
};

toolRegistry.register(getOverallStageCountsTool);
