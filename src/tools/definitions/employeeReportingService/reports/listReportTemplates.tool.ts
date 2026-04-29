/**
 * Lists the calling user's saved content templates.
 *
 * Wraps POST /reports/getAllTemplates. Backend Joi accepts only:
 *   signature.
 * Therefore company-context injection is suppressed.
 *
 * "Templates" here are reusable HTML CONTENT bodies (TipTap output)
 * the user has saved from a past report — NOT the report-type
 * definitions (which are list_report_types). Useful for filling in
 * a new report quickly.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface ReportTemplate {
  id: number;
  template_name: string;
  template_content: string;
  report_id: number;
  status: number;
  created_by_user_id: number;
  company_id: number;
  company_type: string;
  created_at: string;
  updated_at: string;
}

interface ListReportTemplatesResult {
  returned: number;
  templates: ReportTemplate[];
}

interface ReportTemplateRecord {
  id?: number;
  template_name?: string;
  template_content?: string;
  report_id?: number;
  status?: number;
  created_by_user_id?: number;
  company_id?: number;
  company_type?: string;
  created_at?: string;
  updated_at?: string;
}

interface ListReportTemplatesResponse {
  msg?: string;
  data?: ReportTemplateRecord[];
}

export const listReportTemplatesTool: ToolDefinition<
  typeof schema,
  ListReportTemplatesResult
> = {
  name: "list_report_templates",
  title:
    "List report templates — reusable HTML content bodies saved by the caller",
  description:
    "Returns the calling user's saved report content templates: reusable HTML bodies the " +
    "user previously saved from a report, used to pre-fill new reports. Each row includes " +
    "id, template_name, template_content (HTML), the source report_id, and timestamps. " +
    "\n\nUNDERSTANDING THE FLOW: 'Templates' here are CONTENT — the body of a past report " +
    "the user wanted to keep around. They are different from 'report types' (list_report_types) " +
    "which are the recurring DEFINITIONS (frequency, recipients, eligibility). Templates are " +
    "owned by the user who created them; only active (status != 2) templates are returned. " +
    "\n\nUSE THIS TOOL TO: answer 'what templates do I have saved?', 'show me my reusable " +
    "report bodies'. Pair with the create_report mutation (when added) to pre-fill " +
    "report_content from a chosen template_content. " +
    "\n\nNOTE: template_content is full HTML (TipTap output) and can be sizeable; consider " +
    "truncating it in summary views.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["reports", "templates"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<ListReportTemplatesResponse>(
      `${SERVICE.ERS}/reports/getAllTemplates`,
      {},
      ctx,
      { injectCompanyContext: false },
    );

    const records = res.data ?? [];

    const templates: ReportTemplate[] = records.map((r) => ({
      id: r.id ?? 0,
      template_name: r.template_name ?? "",
      template_content: r.template_content ?? "",
      report_id: r.report_id ?? 0,
      status: r.status ?? 1,
      created_by_user_id: r.created_by_user_id ?? 0,
      company_id: r.company_id ?? 0,
      company_type: r.company_type ?? "",
      created_at: r.created_at ?? "",
      updated_at: r.updated_at ?? "",
    }));

    return { returned: templates.length, templates };
  },
};

toolRegistry.register(listReportTemplatesTool);
