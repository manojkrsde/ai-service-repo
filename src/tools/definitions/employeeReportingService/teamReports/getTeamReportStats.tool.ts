/**
 * Returns team-wide report submission statistics — admin / manager view.
 *
 * Wraps POST /team-reports/getTeamStatistics. Backend Joi requires:
 *   signature, company_type, company_id; optional user_id, report_type_id,
 *   report_frequency, start_date, end_date, department_id, search_term.
 * Default snake-case company-context injection works.
 *
 * Permission module is `Team Reports` (different from `Reports`) — only
 * EmployeeAdmin / Admin roles will pass. EmployeeAdmin sees their
 * department; Admin sees the whole company.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const FREQUENCY = z.enum(["daily", "weekly", "monthly", "never"]);

const schema = z.object({
  user_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Restrict to a single employee."),
  department_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Restrict to one department. EmployeeAdmins are auto-scoped to their own department.",
    ),
  report_type_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Restrict to one report type."),
  report_frequency: FREQUENCY.optional().describe(
    "Restrict to all report types of this cadence.",
  ),
  start_date: z
    .string()
    .optional()
    .describe("Window start (YYYY-MM-DD, inclusive)."),
  end_date: z
    .string()
    .optional()
    .describe("Window end (YYYY-MM-DD, inclusive)."),
  search_term: z
    .string()
    .optional()
    .describe("Substring match on report_title (ILIKE)."),
});

interface GetTeamReportStatsResult {
  period: DataPeriodRecord;
  summary: DataSummaryRecord;
  total_breakdown: UserReportBreakdown[];
  submitted_on_time_breakdown: UserReportBreakdown[];
  submitted_late_breakdown: UserReportBreakdown[];
  overdue_breakdown: UserReportBreakdown[];
}

interface UserReportBreakdown {
  user_id: number;
  salutation: string | null;
  fname: string | null;
  lname: string | null;
  profile_pic: string | null;
  designation: string | null;
  department: string | null;
  daily_count: number | null;
  weekly_count: number | null;
  monthly_count: number | null;
  custom_count: number | null;
}

interface DataPeriodRecord {
  start_date: string;
  end_date: string;
}

interface DataSummaryRecord {
  total_submitted: number;
  submitted_on_time: number;
  submitted_late: number;
  overdue_reports: number;
}

interface TeamStatsBody {
  period: DataPeriodRecord;
  summary: DataSummaryRecord;
  total_breakdown: UserReportBreakdown[];
  submitted_on_time_breakdown: UserReportBreakdown[];
  submitted_late_breakdown: UserReportBreakdown[];
  overdue_breakdown: UserReportBreakdown[];
}

interface GetTeamReportStatsResponse {
  msg: string;
  data: TeamStatsBody;
}

export const getTeamReportStatsTool: ToolDefinition<
  typeof schema,
  GetTeamReportStatsResult
> = {
  name: "get_team_report_stats",
  title:
    "Get team report stats — submission rates across the team / department",
  description:
    "Returns team-wide report submission KPIs: total_employees, submitted_on_time, " +
    "submitted_late, overdue counts plus matching percentages, and a per-user breakdown " +
    "(by_user[]) with each employee's individual on-time / late / overdue tallies. " +
    "\n\nUNDERSTANDING THE FLOW: This is the ADMIN/MANAGER view (permission module 'Team " +
    "Reports'). EmployeeAdmins are auto-scoped to their own department; Admins see the " +
    "full company. Regular employees lack permission and will get HTTP 401. To narrow " +
    "down: filter by user_id (one person), department_id (one department, if Admin), " +
    "report_type_id (one type), or report_frequency (all types of a cadence). " +
    "\n\nUSE THIS TOOL TO: answer 'how is the team doing on reports this month?', 'what's " +
    "the on-time rate for the engineering department?', 'which employees are slipping?'. " +
    "For row-level detail (each individual report) use list_team_reports. " +
    "\n\nNOTE: 'overdue' counts reports the user was EXPECTED to file but didn't — computed " +
    "by expanding each user's eligible report-type schedules and subtracting actual " +
    "submissions. Percentages are rounded to one decimal.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["reports", "team", "stats"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {};
    if (input.user_id !== undefined) body["user_id"] = input.user_id;
    if (input.department_id !== undefined)
      body["department_id"] = input.department_id;
    if (input.report_type_id !== undefined)
      body["report_type_id"] = input.report_type_id;
    if (input.report_frequency)
      body["report_frequency"] = input.report_frequency;
    if (input.start_date) body["start_date"] = input.start_date;
    if (input.end_date) body["end_date"] = input.end_date;
    if (input.search_term) body["search_term"] = input.search_term;

    const res = await apiPost<GetTeamReportStatsResponse>(
      `${SERVICE.ERS}/team-reports/getTeamStatistics`,
      body,
      ctx,
    );

    const data = res.data ?? {};

    return {
      period: data.period,
      summary: data.summary,
      total_breakdown: data.total_breakdown,
      submitted_on_time_breakdown: data.submitted_on_time_breakdown,
      submitted_late_breakdown: data.submitted_late_breakdown,
      overdue_breakdown: data.overdue_breakdown,
    };
  },
};

toolRegistry.register(getTeamReportStatsTool);
