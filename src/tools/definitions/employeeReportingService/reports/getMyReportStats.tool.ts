/**
 * Returns the calling user's report submission statistics bucketed by
 * outcome (submitted on time, submitted late, custom, overdue).
 *
 * Wraps POST /reports/getUserReportStatistics. Backend Joi accepts only:
 *   signature, search_term?, report_type_id?, report_frequency?,
 *   start_date?, end_date?, sort_by?
 * Therefore company-context injection is suppressed.
 *
 * Always scoped to the calling user. Default date range is the current
 * month if neither start_date nor end_date is provided.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const FREQUENCY = z.enum(["daily", "weekly", "monthly", "never"]);

const schema = z.object({
  search_term: z
    .string()
    .optional()
    .describe("Substring match on report_title (ILIKE)."),
  report_type_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Filter to a single report type."),
  report_frequency: FREQUENCY.optional().describe(
    "Filter to all report types of this cadence.",
  ),
  start_date: z
    .string()
    .optional()
    .describe("Window start (YYYY-MM-DD). Defaults to current month start."),
  end_date: z
    .string()
    .optional()
    .describe("Window end (YYYY-MM-DD). Defaults to today."),
  sort_by: z
    .string()
    .optional()
    .describe("Sort spec `<field>-<DIR>`, e.g. 'created_at-DESC'."),
});

interface GetMyReportStatsResult {
  period: DataPeriodRecord;
  summary: DataSummaryRecord;
  frequency_breakdown: any[];
  report_details: {
    submitted_on_time?: ReportSummaryRecord[];
    submitted_late?: ReportSummaryRecord[];
    other_reports?: ReportSummaryRecord[];
    overdue_reports?: ReportSummaryRecord[];
  };
}

interface ReportSummaryRecord {
  id?: number;
  report_type_id?: number;
  report_type_name?: string;
  report_title?: string;
  report_date?: string | null;
  submitted_date?: string | null;
  is_draft?: boolean;
  status?: number;
  submission_status?: string;
}

interface DataPeriodRecord {
  start_date: string;
  end_date: string;
}

interface DataSummaryRecord {
  total_reports: number;
  submitted_on_time: number;
  submitted_late: number;
  other_reports: number;
  overdue_reports: number;
}

interface MyReportStatsBody {
  period: DataPeriodRecord;
  summary: DataSummaryRecord;
  frequency_breakdown: any[];
  report_details: {
    submitted_on_time?: ReportSummaryRecord[];
    submitted_late?: ReportSummaryRecord[];
    other_reports?: ReportSummaryRecord[];
    overdue_reports?: ReportSummaryRecord[];
  };
}

interface GetMyReportStatsResponse {
  msg: string;
  data: MyReportStatsBody;
}

export const getMyReportStatsTool: ToolDefinition<
  typeof schema,
  GetMyReportStatsResult
> = {
  name: "get_my_report_stats",
  title:
    "Get my report stats — submitted-on-time / late / overdue buckets for the caller",
  description:
    "Returns the calling user's reports grouped into four buckets: submitted_on_time " +
    "(submitted before the due_date), submitted_late (submitted after), other_reports " +
    "(custom reports — report_type_id = -1), and overdue_reports (expected by a recurring " +
    "type but never submitted, with a past due_date). Each entry is a slim summary " +
    "(id, type, title, dates, status, submission_status). totals.* gives the bucket sizes " +
    "for quick chart numbers. " +
    "\n\nUNDERSTANDING THE FLOW: Always scoped to the caller — there is no admin override. " +
    "Default date range is the current month. The 'overdue_reports' bucket is computed by " +
    "expanding the recurring schedule of each report type (frequency_type, frequency_days, " +
    "intervals) and subtracting the user's actually-submitted dates — so it includes " +
    "reports that were SUPPOSED to be submitted but weren't. " +
    "\n\nUSE THIS TOOL TO: answer 'how am I doing on reports this month?', 'how many " +
    "did I submit late?', 'what's still overdue from me?'. For the team-wide equivalent " +
    "use get_team_report_stats. For row-level detail use list_my_reports. " +
    "\n\nNOTE: report_content (HTML body) is NOT included in this response — by design, the " +
    "buckets are summaries. To read the body of a specific report, list_my_reports filtered " +
    "by id.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["reports", "stats"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {};
    if (input.search_term) body["search_term"] = input.search_term;
    if (input.report_type_id !== undefined)
      body["report_type_id"] = input.report_type_id;
    if (input.report_frequency)
      body["report_frequency"] = input.report_frequency;
    if (input.start_date) body["start_date"] = input.start_date;
    if (input.end_date) body["end_date"] = input.end_date;
    if (input.sort_by) body["sort_by"] = input.sort_by;

    const res = await apiPost<GetMyReportStatsResponse>(
      `${SERVICE.ERS}/reports/getUserReportStatistics`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    const data = res.data ?? {};

    return {
      period: data.period,
      summary: data.summary,
      frequency_breakdown: data.frequency_breakdown,
      report_details: data.report_details,
    };
  },
};

toolRegistry.register(getMyReportStatsTool);
