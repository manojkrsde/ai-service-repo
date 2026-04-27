/**
 * One employee's daily attendance log over a date range, with leave +
 * holiday context.
 *
 * Wraps POST /getEmloyeeDetails. Note: backend reads ALL inputs from
 * `req.query` (user_id, startDate, endDate, company_id, company_type).
 * Body is ignored. user_id defaults to the calling user when omitted.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  user_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Employee user ID. Omit to fetch the calling user's own attendance.",
    ),
  start_date: z
    .string()
    .optional()
    .describe(
      "Start of the date range in YYYY-MM-DD. Defaults to today on the backend when omitted.",
    ),
  end_date: z
    .string()
    .optional()
    .describe(
      "End of the date range in YYYY-MM-DD. Defaults to today on the backend when omitted.",
    ),
});

interface EmployeeAttendanceDetailsResult {
  user_id: number | null;
  start_date: string | null;
  end_date: string | null;
  details: unknown;
}

interface EmployeeDetailsResponse {
  data?: unknown;
}

export const getEmployeeAttendanceDetailsTool: ToolDefinition<
  typeof schema,
  EmployeeAttendanceDetailsResult
> = {
  name: "get_employee_attendance_details",
  title:
    "Get one employee's attendance log — daily check-in/out + leaves + holidays for a range",
  description:
    "Returns one employee's day-by-day attendance log over a date range. Backend interleaves " +
    "biometric/manual check-in records with holidays (from m_events_holidays) and approved " +
    "leaves (with leave-type names) so each row already reflects the resolved status — " +
    "Present / Absent / Holiday / Leave / Half Day. " +
    "\n\nUNDERSTANDING THE FLOW: Backend reads ALL parameters from the query string " +
    "(user_id, startDate, endDate, company_id, company_type). Body content is ignored. " +
    "user_id defaults to the calling user (req.userId) when omitted, so this is also the right " +
    "tool for 'show me my attendance'. The window is clamped to the employee's joining date " +
    "server-side. " +
    "\n\nUSE THIS TOOL TO: open a single employee's attendance journal, answer 'how many " +
    "days has Anita been absent this month?', or surface a per-day timeline with leaves and " +
    "holidays in line. For tenant-wide stats use get_attendance_stats; for the daily grid of " +
    "all employees use get_attendance_range.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["attendance"] },

  handler: async (input, ctx) => {
    if (ctx.companyId === undefined || ctx.companyType === undefined) {
      throw new Error(
        "[AUTH_ERROR] Company context not available on session.",
      );
    }

    const params = new URLSearchParams();
    params.set("company_id", String(ctx.companyId));
    params.set("company_type", ctx.companyType);
    if (input.user_id !== undefined) params.set("user_id", String(input.user_id));
    if (input.start_date) params.set("startDate", input.start_date);
    if (input.end_date) params.set("endDate", input.end_date);

    const qs = params.toString();

    const res = await apiPost<EmployeeDetailsResponse>(
      `${SERVICE.ATTENDANCE}/getEmloyeeDetails${qs ? `?${qs}` : ""}`,
      {},
      ctx,
      { injectCompanyContext: false },
    );

    return {
      user_id: input.user_id ?? null,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      details: res.data ?? null,
    };
  },
};

toolRegistry.register(getEmployeeAttendanceDetailsTool);
