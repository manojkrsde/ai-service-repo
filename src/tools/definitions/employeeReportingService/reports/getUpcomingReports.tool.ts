/**
 * Returns reports the calling user is expected to submit but hasn't —
 * computed by expanding each eligible recurring report-type's schedule.
 *
 * Wraps POST /reports/getUpcomingReportTypes. Backend Joi accepts:
 *   signature, start_date?, end_date? (last 30 days default).
 * Therefore company-context injection is suppressed.
 *
 * Each entry includes the report-type metadata (frequency, intervals,
 * description, recipients) plus a synthesised due_date and an
 * `is_overdue` flag — the schedule is expanded server-side using the
 * user's department/designation eligibility, holiday blackouts and DOJ.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  start_date: z
    .string()
    .optional()
    .describe(
      "Window start (YYYY-MM-DD). Defaults to 30 days ago when omitted.",
    ),
  end_date: z
    .string()
    .optional()
    .describe("Window end (YYYY-MM-DD). Defaults to today when omitted."),
});

interface VisibleToUser {
  id: number;
  salutation: string;
  fname: string;
  lname: string;
  email: string;
}

interface PendingReport {
  id: number;
  name: string;
  description: string | null;
  frequency_type: string;
  frequency_days: number[];
  weekly_interval: number | null;
  monthly_interval: number | null;
  start_date: string;
  end_date: string | null;
  report_date: string;
  due_date: string;
  is_overdue: boolean;
  submission_status: string;
  visible_to: VisibleToUser[];
}

interface GetUpcomingReportsResult {
  start_date: string | null;
  end_date: string | null;
  pending_count: number;
  overdue_count: number;
  pending_reports: PendingReport[];
}

interface PendingReportRecord {
  id?: number;
  name?: string;
  description?: string | null;
  frequency_type?: string;
  frequency_days?: number[];
  weekly_interval?: number | null;
  monthly_interval?: number | null;
  start_date?: string;
  end_date?: string | null;
  report_date?: string;
  due_date?: string;
  is_overdue?: boolean;
  submission_status?: string;
  visible_to?: VisibleToUser[];
}

interface UpcomingReportsBody {
  pending_reports?: PendingReportRecord[];
  filters?: { start_date?: string; end_date?: string };
}

interface GetUpcomingReportsResponse {
  msg?: string;
  data?: UpcomingReportsBody;
}

export const getUpcomingReportsTool: ToolDefinition<
  typeof schema,
  GetUpcomingReportsResult
> = {
  name: "get_upcoming_reports",
  title:
    "Get upcoming reports — pending and overdue report submissions for the caller",
  description:
    "Returns reports the calling user is expected to submit (per their recurring report-type " +
    "eligibility) but hasn't yet — within the requested window. Each entry has the report-type " +
    "metadata (id, name, description, frequency_type, frequency_days, weekly/monthly intervals, " +
    "start/end_date), a synthesised due_date for the slot, an is_overdue boolean, a " +
    "submission_status label ('overdue' or 'pending'), and visible_to (the resolved list of " +
    "users who would see the submission). " +
    "\n\nUNDERSTANDING THE FLOW: The backend evaluates which report types apply to the user " +
    "(matching department/designation, between start_date and end_date, after DOJ, skipping " +
    "weekends/holidays) and expands the recurring schedule into discrete due-dates. Always " +
    "scoped to the caller. Default window is the last 30 days when both dates are omitted. " +
    "\n\nUSE THIS TOOL TO: answer 'what reports do I still owe?', 'what's overdue from me?', " +
    "'what's coming up that I need to file?'. Pair with list_report_types to learn what each " +
    "report is for, or list_my_reports to see what's already been submitted. " +
    "\n\nNOTE: pending_count and overdue_count are derived locally by counting buckets — " +
    "the backend itself doesn't return these as headline numbers. The list is naturally " +
    "ordered by due_date ascending (earliest first).",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["reports", "pending"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {};
    if (input.start_date) body["start_date"] = input.start_date;
    if (input.end_date) body["end_date"] = input.end_date;

    const res = await apiPost<GetUpcomingReportsResponse>(
      `${SERVICE.ERS}/reports/getUpcomingReportTypes`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    const data = res.data ?? {};
    const records = data.pending_reports ?? [];

    const pending_reports: PendingReport[] = records.map((r) => ({
      id: r.id ?? 0,
      name: r.name ?? "",
      description: r.description ?? null,
      frequency_type: r.frequency_type ?? "never",
      frequency_days: r.frequency_days ?? [],
      weekly_interval: r.weekly_interval ?? null,
      monthly_interval: r.monthly_interval ?? null,
      start_date: r.start_date ?? "",
      end_date: r.end_date ?? null,
      report_date: r.report_date ?? "",
      due_date: r.due_date ?? "",
      is_overdue: r.is_overdue ?? false,
      submission_status: r.submission_status ?? "pending",
      visible_to:
        r?.visible_to?.map((v) => {
          return {
            id: v.id,
            salutation: v.salutation,
            fname: v.fname,
            lname: v.lname,
            email: v.email,
          };
        }) || [],
    }));

    const overdue_count = pending_reports.filter((r) => r.is_overdue).length;

    return {
      start_date: data.filters?.start_date ?? input.start_date ?? null,
      end_date: data.filters?.end_date ?? input.end_date ?? null,
      pending_count: pending_reports.length,
      overdue_count,
      pending_reports,
    };
  },
};

toolRegistry.register(getUpcomingReportsTool);
