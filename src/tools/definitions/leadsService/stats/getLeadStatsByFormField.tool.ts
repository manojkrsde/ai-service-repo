/**
 * Lead/deal stats grouped by a form-response geography field
 * (city / state / country / district) or aggregated as a single total.
 *
 * Wraps POST /getLeadStatsByFormKey. Middleware requires
 * signature + company_id + company_type + type + optional filters.
 * Backend extracts the chosen field from the lead's `response` JSON
 * (case-insensitive: "City"/"city", "State"/"state", etc.) and
 * returns a row per distinct value with conversion counts.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  kind: z
    .enum(["lead", "deal"])
    .default("lead")
    .describe(
      "'lead' returns lead stats (type=1), 'deal' returns deal stats (type=2)",
    ),
  group_by: z
    .enum(["all", "city", "state", "country", "district"])
    .default("all")
    .describe(
      "Aggregation dimension. 'all' returns one row 'Total' over the whole tenant. 'city' / 'state' / 'country' / 'district' bucket leads by the matching field in the form response.",
    ),
  include_growth: z
    .boolean()
    .default(false)
    .describe(
      "When true, each row also includes growth-vs-previous-period counts (current vs equivalent prior window).",
    ),
  start_date: z
    .string()
    .optional()
    .describe(
      "Start of date range in YYYY-MM-DD. Omit both dates to use backend defaults.",
    ),
  end_date: z.string().optional().describe("End of date range in YYYY-MM-DD."),
  employee_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Scope to a single employee (admin only — non-admin callers are auto-scoped server-side).",
    ),
  department_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Scope to a department (admin only)."),
});

interface FormFieldStatRow {
  name: string;
  total_leads: number;
  converted: number;
  lost: number;
  in_process: number;
  growth?: {
    total_leads: number;
    converted: number;
    lost: number;
    in_process: number;
  };
  previous?: {
    total_leads: number;
    converted: number;
    lost: number;
    in_process: number;
  };
}

interface LeadStatsByFormFieldResult {
  kind: "lead" | "deal";
  group_by: string;
  date_range_applied: unknown;
  rows: FormFieldStatRow[];
}

interface StatsResponse {
  data: {
    leads: {
      group_by: string;
      form_key_stats: FormFieldStatRow[];
    };
    dateRangeApplied: unknown;
  };
}

export const getLeadStatsByFormFieldTool: ToolDefinition<
  typeof schema,
  LeadStatsByFormFieldResult
> = {
  name: "get_lead_stats_by_form_field",
  title:
    "Get lead/deal stats by geography form field — total or city/state/country/district",
  description:
    "Aggregates lead (or deal) counts grouped by a single form-response geography field. " +
    "Backend reads the chosen field directly out of each lead's stored form response JSON, " +
    "case-insensitively, and returns one row per distinct value with: total_leads, converted " +
    "(stage='won'), lost (stage='lost'), in_process (everything else). When include_growth=true " +
    "every row also gets growth percentages and previous-period counts. Group by 'all' returns " +
    "a single tenant-wide 'Total' row. " +
    "\n\nUNDERSTANDING THE FLOW: Lead-form responses are stored as one JSON blob per lead; this " +
    "endpoint pulls the City/State/Country/District key from that blob. Leads whose response " +
    "doesn't contain the field are bucketed as 'Unknown'. Non-admin callers are auto-scoped to " +
    "their own assigned leads server-side. " +
    "\n\nUSE THIS TOOL TO: rank cities/states by lead volume or conversion count, see where " +
    "leads come from geographically, compare current-period vs previous-period regional " +
    "performance (with include_growth), or pull a tenant-wide total with a single row. " +
    "\n\nNOTE: This is the only group_by dimension the backend supports — there is no " +
    "group_by_form / group_by_source here. For source breakdowns or pipeline-stage breakdowns " +
    "use get_user_lead_stats. For raw stage counts on a single form use get_overall_stage_counts.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["analytics", "leads", "geography"] },

  handler: async (input, ctx) => {
    const type = input.kind === "deal" ? 2 : 1;

    const filters: Record<string, unknown> = {
      group_by: input.group_by,
      include_growth: input.include_growth,
    };
    if (input.start_date && input.end_date) {
      filters["date_range"] = {
        start_date: input.start_date,
        end_date: input.end_date,
      };
    }
    if (input.employee_id !== undefined) {
      filters["employee_id"] = input.employee_id;
    }
    if (input.department_id !== undefined) {
      filters["department_id"] = input.department_id;
    }

    const res = await apiPost<StatsResponse>(
      `${SERVICE.LEADS}/getLeadStatsByFormKey`,
      { type, filters },
      ctx,
    );

    const leads = res.data?.leads ?? {
      group_by: input.group_by,
      form_key_stats: [],
    };

    return {
      kind: input.kind,
      group_by: leads.group_by ?? input.group_by,
      date_range_applied: res.data?.dateRangeApplied ?? null,
      rows: leads.form_key_stats ?? [],
    };
  },
};

toolRegistry.register(getLeadStatsByFormFieldTool);
