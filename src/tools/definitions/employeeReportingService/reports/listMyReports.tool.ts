/**
 * Lists the calling user's own reports — paginated, with filters.
 *
 * Wraps POST /reports/getAllUserReports. Backend Joi accepts only:
 *   signature, page (req), limit (req, max 50), search_term?,
 *   report_type_id?, report_frequency? ('daily'|'weekly'|'monthly'|'never'),
 *   start_date?, end_date?, sort_by? (e.g. 'report_date-DESC').
 * No company_id/company_type in body — they come from the JWT. Therefore
 * company-context injection is suppressed.
 *
 * Always scoped to the calling user (req.requesting_user_id) — there is
 * no admin override on this endpoint. For an admin team-wide view use
 * list_team_reports.
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
    .default(10)
    .describe("Page size, max 50 (backend caps it)."),
  search_term: z
    .string()
    .optional()
    .describe("Case-insensitive substring match on report_title (ILIKE)."),
  report_type_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Filter to one report type. Use list_report_types to discover available IDs.",
    ),
  report_frequency: FREQUENCY.optional().describe(
    "Filter to all report types of this cadence (daily/weekly/monthly/never).",
  ),
  start_date: z
    .string()
    .optional()
    .describe(
      "Filter on report_date (YYYY-MM-DD, inclusive). Defaults to current month start.",
    ),
  end_date: z
    .string()
    .optional()
    .describe(
      "Filter on report_date (YYYY-MM-DD, inclusive). Defaults to current month end.",
    ),
  sort_by: z
    .string()
    .optional()
    .describe(
      "Sort spec as `<field>-<DIR>`, e.g. 'report_date-DESC' or 'created_at-ASC'. " +
        "Default is 'report_date-DESC'.",
    ),
});

interface VisibleToUser {
  id?: number;
  fname?: string;
  lname?: string;
  email?: string;
  designation?: string;
}

interface MyReportItem {
  id: number;
  user_id: number;
  report_type_id: number;
  report_type_name: string;
  report_title: string;
  report_content: string;
  report_date: string | null;
  submitted_at: string | null;
  is_draft: boolean;
  status: number;
  status_text: string;
  frequency_type: string | null;
  weekly_interval: number | null;
  monthly_interval: number | null;
  attachments_count: number;
  attachments: unknown[];
  shows_to: number[];
  visible_to: VisibleToUser[];
  is_submitted_late: boolean;
  created_at: string;
  updated_at: string;
}

interface Pagination {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
  has_next_page: boolean | null;
  has_prev_page: boolean | null;
}

interface Filters {
  report_frequency: string | null;
  search_term: string | null;
  report_type_id: number | null;
  start_date: string | null;
  end_date: string | null;
}

interface ListMyReportsResult {
  pagination: Pagination;
  returned: number;
  reports: MyReportItem[];
  filters: Filters;
}

interface ReportRecord {
  id?: number;
  user_id?: number;
  report_type_id?: number;
  report_type_name?: string;
  report_title?: string;
  report_content?: string;
  report_date?: string | null;
  submitted_at?: string | null;
  is_draft?: boolean;
  status?: number;
  status_text?: string;
  progress?: number | string;
  frequency_type?: string | null;
  weekly_interval?: number | null;
  monthly_interval?: number | null;
  attachments_count?: number;
  attachments?: unknown[];
  shows_to?: number[];
  visible_to?: VisibleToUser[];
  can_edit?: boolean;
  edit_deadline?: string | null;
  edit_reason?: string | null;
  is_submitted_late?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface PaginationRecord {
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  itemsPerPage?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

interface ListMyReportsBody {
  reports: ReportRecord[];
  pagination: PaginationRecord;
  filters: Filters;
}

interface ListMyReportsResponse {
  msg: string;
  data: ListMyReportsBody;
}

export const listMyReportsTool: ToolDefinition<
  typeof schema,
  ListMyReportsResult
> = {
  name: "list_my_reports",
  title:
    "List my reports — paginated list of reports submitted by or owned by me",
  description:
    "Returns the calling user's own reports, paginated, with rich filters. Each report row " +
    "includes id, report_type_id + report_type_name, title, content (HTML), report_date, " +
    "submitted_at, is_draft, status + status_text, progress, frequency metadata, attachments " +
    "(+ count), shows_to (recipient user IDs), visible_to (resolved recipient objects), " +
    "can_edit + edit_deadline + edit_reason, and is_submitted_late. " +
    "\n\nUNDERSTANDING THE FLOW: Always scoped to the caller — there's no admin override on " +
    "this endpoint. Default date range is the current month. To narrow by report type use " +
    "report_type_id (look it up via list_report_types) or by cadence use report_frequency. " +
    "limit is hard-capped at 50 server-side. " +
    "\n\nUSE THIS TOOL TO: answer 'what reports have I submitted this month?', 'show me my " +
    "drafts', 'find my reports of type X'. For an aggregated buckets view (on-time vs late) " +
    "use get_my_report_stats. For team-wide / admin views use list_team_reports. " +
    "\n\nNOTE: report_content is full HTML (TipTap output) and can be large; consider " +
    "ignoring it for list views. The shows_to array contains raw user IDs; visible_to has " +
    "the resolved {id, fname, lname, email} objects.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["reports", "list"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      page: input.page,
      limit: input.limit,
    };
    if (input.search_term) body["search_term"] = input.search_term;
    if (input.report_type_id !== undefined)
      body["report_type_id"] = input.report_type_id;
    if (input.report_frequency)
      body["report_frequency"] = input.report_frequency;
    if (input.start_date) body["start_date"] = input.start_date;
    if (input.end_date) body["end_date"] = input.end_date;
    if (input.sort_by) body["sort_by"] = input.sort_by;

    const res = await apiPost<ListMyReportsResponse>(
      `${SERVICE.ERS}/reports/getAllUserReports`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    const data = res.data ?? {};
    const records = data.reports ?? [];
    const pag = data.pagination ?? {};

    const reports: MyReportItem[] = records.map((r) => ({
      id: r.id ?? 0,
      user_id: r.user_id ?? 0,
      report_type_id: r.report_type_id ?? 0,
      report_type_name: r.report_type_name ?? "",
      report_title: r.report_title ?? "",
      report_content: r.report_content ?? "",
      report_date: r.report_date ?? null,
      submitted_at: r.submitted_at ?? null,
      is_draft: r.is_draft ?? false,
      status: r.status ?? 1,
      status_text: r.status_text ?? "",
      frequency_type: r.frequency_type ?? null,
      weekly_interval: r.weekly_interval ?? null,
      monthly_interval: r.monthly_interval ?? null,
      attachments_count: r.attachments_count ?? 0,
      attachments: r.attachments ?? [],
      shows_to: r.shows_to ?? [],
      visible_to: r.visible_to ?? [],
      is_submitted_late: r.is_submitted_late ?? false,
      created_at: r.created_at ?? "",
      updated_at: r.updated_at ?? "",
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

toolRegistry.register(listMyReportsTool);
