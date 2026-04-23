/**
 * Lists available lead capture forms with their pipeline associations.
 *
 * Calls /getAllLeadForms and resolves pipeline names from /getAllPipelines.
 * Useful as a discovery step before calling create_lead or get_form_lead_stats.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface FormSummary {
  id: number;
  name: string;
  pipeline_id: number | null;
  pipeline_name: string | null;
  field_count: number;
}

interface ListFormsResult {
  forms: FormSummary[];
}

interface FieldEntry {
  fieldName?: string;
  [key: string]: unknown;
}

interface FormRecord {
  id?: number;
  name?: string;
  pipeline_id?: number | null;
  structure?: FieldEntry[] | unknown;
}

interface AllFormsResponse {
  data?: FormRecord[];
}

interface PipelineRecord {
  id?: number;
  pipeline_name?: string;
}

interface AllPipelinesResponse {
  data?: PipelineRecord[];
}

export const listFormsTool: ToolDefinition<typeof schema, ListFormsResult> = {
  name: "list_forms",
  title: "List Forms",
  description:
    "Returns all lead capture forms available for the company, including their associated pipeline and the number of fields. " +
    "Use this to discover form IDs before calling create_lead or get_form_lead_stats.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["config", "forms"] },

  handler: async (_input, ctx) => {
    // Fetch forms and pipelines in parallel
    const [formsRes, pipelinesRes] = await Promise.all([
      apiPost<AllFormsResponse>(`${SERVICE.LEADS}/getAllLeadForms`, {}, ctx),
      apiPost<AllPipelinesResponse>(`${SERVICE.LEADS}/getAllPipelines`, {}, ctx),
    ]);

    const pipelineNameMap = new Map<number, string>();
    for (const p of pipelinesRes.data ?? []) {
      if (p.id !== undefined) {
        pipelineNameMap.set(p.id, p.pipeline_name ?? `Pipeline ${p.id}`);
      }
    }

    const forms: FormSummary[] = (formsRes.data ?? []).map((f) => {
      const structure = f.structure;
      const fieldCount = Array.isArray(structure) ? structure.length : 0;
      const pid = f.pipeline_id ?? null;

      return {
        id: f.id ?? 0,
        name: f.name ?? `Form ${f.id ?? "?"}`,
        pipeline_id: pid,
        pipeline_name:
          pid !== null ? (pipelineNameMap.get(pid) ?? null) : null,
        field_count: fieldCount,
      };
    });

    return { forms };
  },
};

toolRegistry.register(listFormsTool);
