// AUDIT (v1):
// - Verdict: KEEP
// - Good drop-off math over `/leadDashboardPipeline`; pipeline-definition
//   lookup for stage names is correct.

/**
 * Answers: "What does our lead pipeline look like? Where are leads dropping off?"
 *
 * Fetches stage-by-stage counts from the dashboard pipeline endpoint and the
 * pipeline definition (for stage names), then computes drop-off rates locally.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import { resolveDateRange } from "../../../../helpers/time-range.helper.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  pipeline_id: z
    .number()
    .int()
    .positive()
    .describe("The ID of the pipeline to analyse"),
  time_range: z
    .enum(["today", "this_week", "this_month", "last_30_days", "all_time"])
    .default("all_time")
    .describe("The time window for counting leads per stage"),
});

interface FunnelStage {
  name: string;
  count: number;
  percentage: number;
  drop_off_pct: number | null;
}

interface PipelineFunnel {
  pipeline_id: number;
  pipeline_name: string;
  total_leads: number;
  time_range: string;
  stages: FunnelStage[];
}

interface PipelineRecord {
  id?: number;
  pipeline_name?: string;
  stages?: string[];
}

interface AllPipelinesResponse {
  data?: PipelineRecord[];
}

interface StageCounts {
  pipeline_char?: string;
  stage_name?: string;
  count?: number;
}

interface DashboardPipelineResponse {
  data?: StageCounts[] | Record<string, number>;
}

interface LeadRecord {
  pipeline_char?: string;
}

interface AllLeadsResponse {
  data?: LeadRecord[];
}

export const getPipelineFunnelTool: ToolDefinition<
  typeof schema,
  PipelineFunnel
> = {
  name: "get_pipeline_funnel",
  title: "Get Pipeline Funnel",
  description:
    "Shows how many leads are at each stage of a pipeline and where the biggest drop-offs occur. " +
    "Use this to answer: What does our sales funnel look like? How many leads reach the Demo stage? " +
    "Where are we losing the most prospects?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["analytics", "pipeline", "leads"] },

  handler: async (input, ctx) => {
    const dateRange = resolveDateRange(input.time_range);
    const dateBody: Record<string, unknown> = {};
    if (dateRange) {
      dateBody["start_date"] = dateRange.start_date;
      dateBody["end_date"] = dateRange.end_date;
    }

    const pipelinesRes = await apiPost<AllPipelinesResponse>(`${SERVICE.LEADS}/getAllPipelines`,
      {},
      ctx,
    );
    const pipeline = (pipelinesRes.data ?? []).find(
      (p) => p.id === input.pipeline_id,
    );
    const pipelineName = pipeline?.pipeline_name ?? `Pipeline ${input.pipeline_id}`;
    const stageNames: string[] = pipeline?.stages ?? [];

    const dashBody: Record<string, unknown> = {
      ...dateBody,
      pipeline_id: input.pipeline_id,
    };

    const stageCounts = new Map<string, number>();

    try {
      const dashRes = await apiPost<DashboardPipelineResponse>(`${SERVICE.LEADS}/leadDashboardPipeline`,
        dashBody,
        ctx,
      );

      if (Array.isArray(dashRes.data)) {
        for (const entry of dashRes.data as StageCounts[]) {
          const key = entry.pipeline_char ?? entry.stage_name ?? "";
          if (key) stageCounts.set(key, entry.count ?? 0);
        }
      } else if (dashRes.data && typeof dashRes.data === "object") {
        for (const [k, v] of Object.entries(dashRes.data)) {
          if (typeof v === "number") stageCounts.set(k, v);
        }
      }
    } catch {
      // Fallback to raw aggregation
    }

    if (stageCounts.size === 0) {
      const raw = await apiPost<AllLeadsResponse>(`${SERVICE.LEADS}/getAllLeadsResponse`,
        { ...dashBody, limit: 2000, offset: 0 },
        ctx,
      );
      for (const lead of raw.data ?? []) {
        const k = lead.pipeline_char ?? "unknown";
        stageCounts.set(k, (stageCounts.get(k) ?? 0) + 1);
      }
    }

    const orderedKeys =
      stageNames.length > 0
        ? stageNames
        : [...stageCounts.keys()];

    const total = [...stageCounts.values()].reduce((s, n) => s + n, 0);

    const stages: FunnelStage[] = orderedKeys.map((name, i) => {
      const count = stageCounts.get(name) ?? 0;
      const pct = total > 0 ? Math.round((count / total) * 100) : 0;

      let dropOff: number | null = null;
      if (i > 0) {
        const prevKey = orderedKeys[i - 1];
        const prevCount = prevKey !== undefined ? (stageCounts.get(prevKey) ?? 0) : 0;
        dropOff =
          prevCount > 0 ? Math.round(((prevCount - count) / prevCount) * 100) : 0;
      }

      return { name, count, percentage: pct, drop_off_pct: dropOff };
    });

    return {
      pipeline_id: input.pipeline_id,
      pipeline_name: pipelineName,
      total_leads: total,
      time_range: input.time_range,
      stages,
    };
  },
};

toolRegistry.register(getPipelineFunnelTool);
