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
  fields_count: number;
  company_id: number;
  company_type: string;
  status: string;
  assigned_employees_id: number[] | [];
  created_at: string;
  pipeline_stages: string[];
  company_name: string;
}

interface ListFormsResult {
  forms: FormSummary[];
}

interface FormRecord {
  key: number;
  LeadFormName: string;
  pipeline_id: number | null;
  structure: any;
  Pipeline: string | null;
  field_count: number;
  CompanyId: number;
  CompanyType: string;
  CompanyName: string;
  CreatedDate: string;
  Status: string;
  employees: number[] | [];
}

interface AllFormsResponse {
  data: {
    data: FormRecord[];
  };
}

interface PipelineRecord {
  key?: number;
  Pipeline_Name: string;
  CreatedDate: string;
  Status: string;
  Stages: string[];
  Type: string;
}

interface AllPipelinesResponse {
  data: {
    data: PipelineRecord[];
  };
}

export const listFormsTool: ToolDefinition<typeof schema, ListFormsResult> = {
  name: "list_forms",
  title: "Browse lead capture forms — pipelines, stages, and assignments",
  description:
    "Returns all lead capture forms configured for the company. Each form includes: " +
    "id, name, status, field count, assigned employee IDs, creation date, and the full " +
    "pipeline association — pipeline id, name, and ordered stage list (e.g. New, Follow Up, Won, Lost). " +
    "\n\nUNDERSTANDING THE FLOW: Pipelines define the stages a lead moves through. " +
    "A form is linked to one pipeline at creation time, meaning every lead captured " +
    "via that form follows the same pipeline and its stages. " +
    "form_id is required by most lead tools (list_leads, create_lead, move_lead_to_stage, " +
    "get_form_lead_stats, get_lead_follow_ups) — so this is almost always the first tool to call. " +
    "\n\nUSE THIS TOOL TO: resolve a form name to its form_id, discover which pipeline " +
    "and stages apply to a set of leads, know valid stage names before moving a lead, " +
    "check which employees are assigned to a form, or map out the full lead capture structure. " +
    "\n\nNOTE: If the user asks about leads, stages, or pipeline flow and no form_id is " +
    "known yet — always call this first.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["config", "forms"] },

  handler: async (_input, ctx) => {
    const [formsRes, pipelinesRes] = await Promise.all([
      apiPost<AllFormsResponse>(`${SERVICE.LEADS}/getAllLeadForms`, {}, ctx, {
        injectCompanyContext: false,
      }),
      apiPost<AllPipelinesResponse>(
        `${SERVICE.LEADS}/getAllPipelines`,
        {},
        ctx,
        {
          injectCompanyContext: false,
        },
      ),
    ]);

    const formsApiRes = formsRes.data.data ?? [];
    const pipelineApiRes = pipelinesRes.data.data ?? [];

    const pipelineNameMap = new Map<number, PipelineRecord>();
    for (const p of pipelineApiRes) {
      if (p.key !== undefined) {
        pipelineNameMap.set(p.key, p);
      }
    }

    const forms: FormSummary[] = formsApiRes.map((f) => {
      const structure = f.structure;
      const fieldCount = Array.isArray(structure) ? structure.length : 0;
      const pid = f.pipeline_id ?? null;
      const pipeline = pid !== null ? pipelineNameMap.get(pid) : null;

      return {
        id: f.key ?? 0,
        name: f.LeadFormName ?? `Form ${f.key ?? "?"}`,
        pipeline_id: pid,
        pipeline_name: pipeline?.Pipeline_Name ?? `Pipeline ${pid}`,
        pipeline_stages: pipeline?.Stages ?? [],
        fields_count: fieldCount,
        company_id: f.CompanyId,
        company_type: f.CompanyType,
        company_name: f.CompanyName,
        status: f.Status,
        assigned_employees_id: f.employees,
        created_at: f.CreatedDate,
      };
    });

    return { forms };
  },
};

toolRegistry.register(listFormsTool);
