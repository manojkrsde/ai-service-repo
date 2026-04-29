/**
 * Lists every team report (admin / manager view), paginated, with rich
 * filters.
 *
 * Wraps POST /team-reports/getAllTeamReports. Backend Joi requires:
 *   signature, company_type, company_id, page, limit; optional user_id,
 *   report_type_id, report_frequency, start_date, end_date, sort_by,
 *   department_id, search_term.
 * Default snake-case company-context injection works.
 *
 * Permission module is `Team Reports` — only EmployeeAdmin / Admin pass.
 * EmployeeAdmin is auto-scoped to their department.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const FREQUENCY = z.enum(["daily", "weekly", "monthly", "never"]);

const schema = z.object({
  page: z
    .number()
    .int()
    .positive()
    .default(1)
    .describe("Page number (1-indexed)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Page size, max 50 (backend caps it)."),
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
    "Restrict to all report types of a cadence.",
  ),
  start_date: z.string().optional().describe("Window start (YYYY-MM-DD)."),
  end_date: z.string().optional().describe("Window end (YYYY-MM-DD)."),
  search_term: z
    .string()
    .optional()
    .describe("Substring match on report_title (ILIKE)."),
  sort_by: z
    .string()
    .optional()
    .describe("Sort spec `<field>-<DIR>`, e.g. 'report_date-DESC'."),
});

interface ReportUser {
  id: number;
  fname: string;
  lname: string;
  email: string;
  department: string;
}

interface TeamReportItem {
  id: number;
  user: ReportUser | null;
  report_type_id: number;
  report_type_name: string;
  report_title: string;
  report_date: string | null;
  submitted_date: string | null;
  is_draft: boolean;
  status: number;
  submission_status: string;
  created_by: object | null;
}

interface Pagination {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

interface ListTeamReportsResult {
  pagination: Pagination;
  returned: number;
  reports: TeamReportItem[];
  filters: Filters;
}

interface TeamReportRecord {
  id: number;
  user: ReportUser | null;
  report_type_id: number;
  report_type_name: string;
  report_title: string;
  report_date: string | null;
  submitted_date: string | null;
  is_draft: boolean;
  status: number;
  submission_status: string;
  created_by: CreatedUser;
}

interface PaginationRecord {
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  itemsPerPage?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

interface Filters {
  report_frequency: string | null;
  search_term: string | null;
  report_type_id: number | null;
  start_date: string | null;
  end_date: string | null;
}

interface ListTeamReportsBody {
  reports: TeamReportRecord[];
  pagination: PaginationRecord;
  filters: Filters;
}

interface ListTeamReportsResponse {
  msg: string;
  data: ListTeamReportsBody;
}

interface CreatedUser {
  id: number;
  salutation: string;
  fname: string;
  lname: string;
  email: string;
  designation: number | null;
  department: number | null;
}

export const listTeamReportsTool: ToolDefinition<
  typeof schema,
  ListTeamReportsResult
> = {
  name: "list_team_reports",
  title:
    "List team reports — every team / department report, paginated (admin view)",
  description:
    "Returns row-level employee reports across the team or department, paginated. Each row " +
    "has id, the user object (id, fname, lname, email, department), report_type_id + " +
    "report_type_name, report_title, report_date, submitted_date, is_draft, status, and " +
    "submission_status ('submitted_on_time' / 'submitted_late' / 'overdue' etc.). " +
    "\n\nUNDERSTANDING THE FLOW: ADMIN/MANAGER view via permission module 'Team Reports' — " +
    "EmployeeAdmins see only their own department, Admins see the whole company. Regular " +
    "employees get HTTP 401. To answer aggregate questions ('how many on-time?') without " +
    "loading rows use get_team_report_stats. " +
    "\n\nUSE THIS TOOL TO: answer 'show me every late report from engineering this month', " +
    "'what did Alice submit last week?', 'list all overdue weekly reports'. For caller's " +
    "own reports use list_my_reports. For aggregated buckets use get_team_report_stats. " +
    "\n\nNOTE: report_content (HTML body) is NOT returned in this paginated list — for the " +
    "full body of any specific report, use list_my_reports if it's the caller's own, or " +
    "ask an admin to fetch by id (no admin getById endpoint exists yet). limit is hard " +
    "capped at 50.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["reports", "team", "list"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      page: input.page,
      limit: input.limit,
    };
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
    if (input.sort_by) body["sort_by"] = input.sort_by;

    const res = await apiPost<ListTeamReportsResponse>(
      `${SERVICE.ERS}/team-reports/getAllTeamReports`,
      body,
      ctx,
    );

    const data = res.data ?? {};
    const records = data.reports ?? [];
    const pag = data.pagination ?? {};

    const reports: TeamReportItem[] = records.map((r) => ({
      id: r.id ?? 0,
      user: r.user ?? null,
      report_type_id: r.report_type_id ?? 0,
      report_type_name: r.report_type_name ?? "",
      report_title: r.report_title ?? "",
      report_date: r.report_date ?? null,
      submitted_date: r.submitted_date ?? null,
      is_draft: r.is_draft ?? false,
      status: r.status ?? 1,
      submission_status: r.submission_status ?? "",
      created_by: r?.created_by
        ? {
            id: r?.created_by.id,
            salutation: r?.created_by.salutation,
            fname: r?.created_by.fname,
            lname: r?.created_by.lname,
            email: r?.created_by.email,
            department_id: r?.created_by.department,
            designation_id: r?.created_by.designation,
          }
        : {},
    }));

    const pagination: Pagination = {
      current_page: pag.currentPage ?? input.page,
      total_pages: pag.totalPages ?? 1,
      total_items: pag.totalItems ?? reports.length,
      items_per_page: pag.itemsPerPage ?? input.limit,
      has_next_page: pag.hasNextPage ?? false,
      has_prev_page: pag.hasPrevPage ?? false,
    };

    return {
      pagination,
      returned: reports.length,
      reports,
      filters: data.filters,
    };
  },
};

toolRegistry.register(listTeamReportsTool);
