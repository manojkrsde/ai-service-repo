/**
 * Per-employee attendance across a date range.
 *
 * Wraps POST /getEmployeeAttendanceRange. Backend body accepts c_id, c_type,
 * department_id (all optional, strict). startDate + endDate are read from
 * `req.query` and are required by the controller (returns 400 if missing).
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  start_date: z
    .string()
    .describe("Start of the date range in YYYY-MM-DD (required by backend)."),
  end_date: z
    .string()
    .describe("End of the date range in YYYY-MM-DD (required by backend)."),
  department_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Restrict the listing to one department. Use list_departments to discover IDs.",
    ),
});

interface AttendanceRangeResult {
  start_date: string;
  end_date: string;
  records: unknown;
}

interface AttendanceRangeResponse {
  data?: unknown;
}

export const getAttendanceRangeTool: ToolDefinition<
  typeof schema,
  AttendanceRangeResult
> = {
  name: "get_attendance_range",
  title:
    "Get attendance over a date range — daily attendance grid for every employee",
  description:
    "Returns the per-employee daily attendance grid across a start/end date window. Backend " +
    "merges biometric ESSL records and manual check-ins, applies holidays + Sundays, and " +
    "returns the resolved per-day status with check-in / check-out / late / productive metrics. " +
    "Optionally filter to one department. " +
    "\n\nUNDERSTANDING THE FLOW: Backend reads start_date and end_date from the query string " +
    "(?startDate=&endDate=) and rejects the call with HTTP 400 if either is missing. " +
    "Non-admin/department-scoped callers see only their department. Backend payload shape " +
    "varies by company config (biometric on/off) — surface as `records` for the LLM to render. " +
    "\n\nUSE THIS TOOL TO: pull a multi-day attendance grid (e.g. 'show this week's " +
    "attendance' / 'who was absent in the last 7 days'). For a single date use " +
    "get_attendance_by_date; for one employee over a range use get_employee_attendance_details.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["attendance"] },

  handler: async (input, ctx) => {
    if (ctx.companyId === undefined || ctx.companyType === undefined) {
      throw new Error(
        "[AUTH_ERROR] Company context not available on session.",
      );
    }

    const body: Record<string, unknown> = {
      c_id: ctx.companyId,
      c_type: ctx.companyType,
    };
    if (input.department_id !== undefined) {
      body["department_id"] = input.department_id;
    }

    const qs = new URLSearchParams({
      startDate: input.start_date,
      endDate: input.end_date,
    }).toString();

    const res = await apiPost<AttendanceRangeResponse>(
      `${SERVICE.ATTENDANCE}/getEmployeeAttendanceRange?${qs}`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    return {
      start_date: input.start_date,
      end_date: input.end_date,
      records: res.data ?? [],
    };
  },
};

toolRegistry.register(getAttendanceRangeTool);
