/**
 * Comprehensive attendance dashboard stats.
 *
 * Wraps POST /getUserAttendanceStats. Backend body requires
 * signature + company_id + company_type + optional filters
 * ({ date_range:{ start_date, end_date }, employee_id, department_id }).
 *
 * Returns headline attendance metrics with growth-vs-previous-period
 * comparisons, plus a per-user summary block. Non-admin callers are
 * auto-scoped to themselves; EmployeeAdmin callers are scoped to their
 * department; full Admin callers see everything.
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
      "Start of date range in YYYY-MM-DD. Backend supplies a sensible default when omitted.",
    ),
  end_date: z
    .string()
    .optional()
    .describe(
      "End of date range in YYYY-MM-DD. Backend supplies a sensible default when omitted.",
    ),
  employee_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Scope stats to one employee (admin only — non-admin callers are auto-scoped to themselves).",
    ),
  department_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Scope stats to a department (admin only)."),
});

interface AttendanceStatsResult {
  date_range_applied: unknown;
  attendance: unknown;
}

interface StatsResponse {
  data: {
    attendance: unknown;
    dateRangeApplied: unknown;
  };
}

export const getAttendanceStatsTool: ToolDefinition<
  typeof schema,
  AttendanceStatsResult
> = {
  name: "get_attendance_stats",
  title:
    "Get attendance dashboard stats — totals, growth %, per-user summary",
  description:
    "Returns the full attendance analytics block for the dashboard. Includes formatted " +
    "headline metrics (each with current value, previous-period value, and growth %) plus a " +
    "user_attendance_summary with per-employee details over the period. Backend handles " +
    "biometric vs manual record merging, holiday + Sunday exclusions, late detection, and " +
    "productive-hours math server-side. " +
    "\n\nUNDERSTANDING THE FLOW: Filters live under `filters: { date_range, employee_id, " +
    "department_id }` in the body. Non-admin callers are auto-scoped server-side to their own " +
    "attendance regardless of filters. EmployeeAdmin callers are scoped to their own " +
    "department. Full Admin callers can query any employee or department. " +
    "\n\nUSE THIS TOOL TO: power a 'this month vs last month' attendance dashboard, surface " +
    "the late-comers list, or compare attendance percentages across periods. For raw per-day " +
    "rows use get_attendance_range; for the per-employee detailed report use " +
    "get_attendance_report.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["attendance", "analytics", "dashboard"] },

  handler: async (input, ctx) => {
    const filters: Record<string, unknown> = {};
    if (input.start_date && input.end_date) {
      filters["date_range"] = {
        start_date: input.start_date,
        end_date: input.end_date,
      };
    }
    if (input.employee_id !== undefined) filters["employee_id"] = input.employee_id;
    if (input.department_id !== undefined) filters["department_id"] = input.department_id;

    const body: Record<string, unknown> = {};
    if (Object.keys(filters).length > 0) body["filters"] = filters;

    const res = await apiPost<StatsResponse>(
      `${SERVICE.ATTENDANCE}/getUserAttendanceStats`,
      body,
      ctx,
    );

    return {
      date_range_applied: res.data?.dateRangeApplied ?? null,
      attendance: res.data?.attendance ?? null,
    };
  },
};

toolRegistry.register(getAttendanceStatsTool);
