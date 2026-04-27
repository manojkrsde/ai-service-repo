/**
 * Answers: "What pipelines do we have? What stages are in the Sales pipeline?"
 *
 * Calls /getAllPipelines with only a signature (backend middleware rejects
 * other fields). Filtering by `lead` vs `deal` is applied client-side on the
 * returned Type field.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  type: z
    .enum(["lead", "deal", "all"])
    .default("lead")
    .describe(
      "Pipeline type to return. 'lead' (default) returns sales lead pipelines, 'deal' returns deal pipelines, 'all' returns both.",
    ),
});

interface PipelineSummary {
  id: number;
  name: string;
  type: string;
  status: string;
  stages: string[];
  company_id: number;
  company_name: string;
  company_type: string;
  created_at: string;
}

interface ListPipelinesResult {
  total: number;
  pipelines: PipelineSummary[];
}

interface PipelineRecord {
  key?: number;
  Pipeline_Name?: string;
  Company_Name?: string;
  Company_Type?: string;
  Company_Id?: number;
  CreatedDate?: string;
  Status?: string;
  Stages?: string[];
  Type?: string;
}

interface AllPipelinesResponse {
  data: {
    data: PipelineRecord[];
  };
}

export const listPipelinesTool: ToolDefinition<
  typeof schema,
  ListPipelinesResult
> = {
  name: "list_pipelines",
  title: "Browse pipelines — ordered stage lists, type & company scope",
  description:
    "Returns all pipelines configured for the company. Each pipeline includes: " +
    "id, name, type (lead or deal), status, company, creation date, and the full " +
    "ordered list of stages (e.g. New, Contacted, Qualified, Won, Lost). " +
    "\n\nUNDERSTANDING THE FLOW: A pipeline is the stage sequence a lead travels through. " +
    "Every form (see list_forms) is bound to exactly one pipeline, and every lead inherits " +
    "its form's pipeline. Stage names returned here are the exact strings the backend accepts " +
    "when moving a lead between stages. " +
    "\n\nUSE THIS TOOL TO: list all pipelines for the company, discover stage names for a " +
    "pipeline before referencing a stage, find a pipeline's ID, or check whether a pipeline " +
    "is of type 'lead' or 'deal'. " +
    "\n\nNOTE: For form-to-pipeline mapping use list_forms (each form's response includes its " +
    "pipeline name and stages). Type filtering is applied after fetch — the backend returns " +
    "all pipelines regardless of requested type.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "2.0.0", tags: ["config", "pipeline"] },

  handler: async (input, ctx) => {
    const res = await apiPost<AllPipelinesResponse>(
      `${SERVICE.LEADS}/getAllPipelines`,
      {},
      ctx,
      { injectCompanyContext: false },
    );

    const records = res.data?.data ?? [];

    const filtered =
      input.type === "all"
        ? records
        : records.filter(
            (p) => (p.Type ?? "").toLowerCase() === input.type.toLowerCase(),
          );

    const pipelines: PipelineSummary[] = filtered.map((p) => ({
      id: p.key ?? 0,
      name: p.Pipeline_Name ?? `Pipeline ${p.key ?? "?"}`,
      type: p.Type ?? "lead",
      status: p.Status ?? "Active",
      stages: p.Stages ?? [],
      company_id: p.Company_Id ?? 0,
      company_name: p.Company_Name ?? "",
      company_type: p.Company_Type ?? "",
      created_at: p.CreatedDate ?? "",
    }));

    return {
      total: pipelines.length,
      pipelines,
    };
  },
};

toolRegistry.register(listPipelinesTool);
