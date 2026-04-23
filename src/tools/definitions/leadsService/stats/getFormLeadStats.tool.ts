// AUDIT (v1):
// - Verdict: KEEP
// - Uses `/getLeadStatsByFormKey` and resolves form names via
//   `/getAllLeadForms` — correct two-step lookup with fallback.
// - Access: backend auto-scopes both endpoints per caller role.

/**
 * Answers: "How many leads came from each form? What stage are they in?"
 *
 * Calls /getLeadStatsByFormKey for per-form counts, then resolves form names
 * from /getAllLeadForms.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import { resolveDateRange } from "../../../../helpers/time-range.helper.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  form_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Scope to a specific form ID. Omit to return stats for all forms.",
    ),
  time_range: z
    .enum(["today", "this_week", "this_month", "last_30_days", "all_time"])
    .default("this_month")
    .describe("The time window to aggregate leads over"),
});

interface FormStat {
  form_id: number;
  form_name: string;
  total_leads: number;
  by_stage: Record<string, number>;
}

interface FormLeadStats {
  time_range: string;
  forms: FormStat[];
}

interface FormRecord {
  id?: number;
  name?: string;
}

interface AllFormsResponse {
  data?: FormRecord[];
}

interface StatsEntry {
  form_id?: number;
  total?: number;
  stage_counts?: Record<string, number>;
  by_stage?: Record<string, number>;
}

interface FormStatsResponse {
  data?: StatsEntry[] | Record<string, unknown>;
}

interface LeadRecord {
  form_id?: number;
  pipeline_char?: string;
}

interface AllLeadsResponse {
  data?: LeadRecord[];
}

export const getFormLeadStatsTool: ToolDefinition<
  typeof schema,
  FormLeadStats
> = {
  name: "get_form_lead_stats",
  title: "Get Form Lead Stats",
  description:
    "Returns how many leads each lead capture form has received, with a stage-by-stage breakdown. " +
    "Use this to answer: How many leads came from the Website Contact Form? " +
    "Which form converts best? How are form leads distributed across pipeline stages?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["analytics", "forms", "leads"] },

  handler: async (input, ctx) => {
    const dateRange = resolveDateRange(input.time_range);
    const dateBody: Record<string, unknown> = {};
    if (dateRange) {
      dateBody["start_date"] = dateRange.start_date;
      dateBody["end_date"] = dateRange.end_date;
    }

    const formsRes = await apiPost<AllFormsResponse>(`${SERVICE.LEADS}/getAllLeadForms`,
      {},
      ctx,
    );
    const nameMap = new Map<number, string>();
    for (const f of formsRes.data ?? []) {
      if (f.id !== undefined) nameMap.set(f.id, f.name ?? `Form ${f.id}`);
    }

    const statsBody: Record<string, unknown> = { ...dateBody };
    if (input.form_id !== undefined) statsBody["form_id"] = input.form_id;

    let forms: FormStat[] = [];

    try {
      const statsRes = await apiPost<FormStatsResponse>(`${SERVICE.LEADS}/getLeadStatsByFormKey`,
        statsBody,
        ctx,
      );

      const entries = Array.isArray(statsRes.data)
        ? (statsRes.data as StatsEntry[])
        : [];

      if (entries.length > 0) {
        forms = entries.map((e) => {
          const fid = e.form_id ?? 0;
          return {
            form_id: fid,
            form_name: nameMap.get(fid) ?? `Form ${fid}`,
            total_leads: e.total ?? 0,
            by_stage: e.stage_counts ?? e.by_stage ?? {},
          };
        });
      }
    } catch {
      // Stats endpoint unavailable — fall back to raw aggregation
    }

    if (forms.length === 0) {
      const rawBody: Record<string, unknown> = {
        ...dateBody,
        limit: 2000,
        offset: 0,
      };
      if (input.form_id !== undefined) rawBody["form_id"] = input.form_id;

      const raw = await apiPost<AllLeadsResponse>(`${SERVICE.LEADS}/getAllLeadsResponse`,
        rawBody,
        ctx,
      );

      const agg = new Map<number, Record<string, number>>();
      for (const lead of raw.data ?? []) {
        const fid = lead.form_id ?? 0;
        const stage = lead.pipeline_char ?? "unknown";
        if (!agg.has(fid)) agg.set(fid, {});
        const stages = agg.get(fid)!;
        stages[stage] = (stages[stage] ?? 0) + 1;
      }

      for (const [fid, byStage] of agg) {
        forms.push({
          form_id: fid,
          form_name: nameMap.get(fid) ?? `Form ${fid}`,
          total_leads: Object.values(byStage).reduce((s, n) => s + n, 0),
          by_stage: byStage,
        });
      }

      forms.sort((a, b) => b.total_leads - a.total_leads);
    }

    return { time_range: input.time_range, forms };
  },
};

toolRegistry.register(getFormLeadStatsTool);
