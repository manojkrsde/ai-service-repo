/**
 * Lists every active report type (recurring report definition) for the
 * caller's company.
 *
 * Wraps POST /reports/getAllReportTypes. Backend Joi accepts only:
 *   signature.
 * Therefore company-context injection is suppressed; the company comes
 * from the JWT.
 *
 * "Report types" are the RECURRING DEFINITIONS that drive the system —
 * they specify cadence (daily/weekly/monthly/never), eligible
 * departments + designations, recipients (shows_to), and the date
 * window during which the cadence applies. They are NOT the same as
 * "templates" (list_report_templates) which are reusable content bodies.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface ReportType {
  id: number;
  name: string;
  description: string | null;
  frequency_type: string;
  frequency_days: number[];
  weekly_interval: number | null;
  monthly_interval: number | null;
  start_date: string;
  end_date: string | null;
  report_departments: number[];
  report_designations: number[];
  shows_to: number[];
  status: number;
  created_by_user_id: number;
  company_id: number;
  company_type: string;
  created_at: string;
  updated_at: string;
}

interface ListReportTypesResult {
  returned: number;
  report_types: ReportType[];
}

interface ReportTypeRecord {
  id?: number;
  name?: string;
  description?: string | null;
  frequency_type?: string;
  frequency_days?: number[];
  weekly_interval?: number | null;
  monthly_interval?: number | null;
  start_date?: string;
  end_date?: string | null;
  report_departments?: number[];
  report_designations?: number[];
  shows_to?: number[];
  status?: number;
  created_by_user_id?: number;
  company_id?: number;
  company_type?: string;
  created_at?: string;
  updated_at?: string;
}

interface ListReportTypesResponse {
  msg?: string;
  data?: ReportTypeRecord[];
}

export const listReportTypesTool: ToolDefinition<
  typeof schema,
  ListReportTypesResult
> = {
  name: "list_report_types",
  title:
    "List report types — recurring report definitions configured for the company",
  description:
    "Returns every active recurring report-type definition for the caller's company. Each " +
    "row includes id, name, description, frequency_type ('daily'/'weekly'/'monthly'/'never'), " +
    "frequency_days (e.g. [1,2,3,4,5] = weekdays), weekly_interval / monthly_interval, " +
    "start_date / end_date, report_departments + report_designations (eligibility), " +
    "shows_to (recipient user IDs), and status. " +
    "\n\nUNDERSTANDING THE FLOW: Report TYPES are the company-wide DEFINITIONS — they " +
    "drive who is expected to file what report and when. They are different from report " +
    "TEMPLATES (list_report_templates), which are user-saved CONTENT bodies. Use this tool " +
    "to resolve report_type_id values referenced by list_my_reports or get_my_report_stats. " +
    "\n\nUSE THIS TOOL TO: answer 'what reports does the company have configured?', 'what's " +
    "the cadence for the daily standup report?', 'who has to file weekly status reports?'. " +
    "\n\nNOTE: This list is unfiltered — it returns ALL active report types in the company. " +
    "If the user only cares about types they're eligible for, follow up with " +
    "get_upcoming_reports which filters by department/designation match.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["reports", "types"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<ListReportTypesResponse>(
      `${SERVICE.ERS}/reports/getAllReportTypes`,
      {},
      ctx,
      { injectCompanyContext: false },
    );

    const records = res.data ?? [];
    const report_types: ReportType[] = records.map((r) => ({
      id: r.id ?? 0,
      name: r.name ?? "",
      description: r.description ?? null,
      frequency_type: r.frequency_type ?? "never",
      frequency_days: r.frequency_days ?? [],
      weekly_interval: r.weekly_interval ?? null,
      monthly_interval: r.monthly_interval ?? null,
      start_date: r.start_date ?? "",
      end_date: r.end_date ?? null,
      report_departments: r.report_departments ?? [],
      report_designations: r.report_designations ?? [],
      shows_to: r.shows_to ?? [],
      status: r.status ?? 1,
      created_by_user_id: r.created_by_user_id ?? 0,
      company_id: r.company_id ?? 0,
      company_type: r.company_type ?? "",
      created_at: r.created_at ?? "",
      updated_at: r.updated_at ?? "",
    }));

    return { returned: report_types.length, report_types };
  },
};

toolRegistry.register(listReportTypesTool);
