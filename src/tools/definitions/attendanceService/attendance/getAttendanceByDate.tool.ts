/**
 * Per-employee attendance for a single date.
 *
 * Wraps POST /getEmployeeAttendance. Backend body accepts only c_id, c_type,
 * department_id (all optional, strict schema). The date is read from
 * `req.query.date` server-side, so we attach it as a query string.
 *
 * Default `injectCompanyContext: false` because the backend uses c_id/c_type
 * (not company_id/company_type), and Joi rejects unknown fields.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  date: z
    .string()
    .optional()
    .describe(
      "Attendance date in YYYY-MM-DD. Defaults to today on the backend when omitted.",
    ),
  department_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Restrict the listing to one department. Use list_departments to discover IDs.",
    ),
});

interface AttendanceRow {
  user_id?: number;
  essl_id?: string;
  name?: string;
  date?: string;
  check_in?: string | null;
  check_out?: string | null;
  status?: string;
  is_late?: boolean;
  late_seconds?: number;
  productive_seconds?: number;
}

interface AttendanceByDateResult {
  date: string | null;
  total: number;
  records: AttendanceRow[];
}

interface AttendanceResponse {
  data?: { records?: AttendanceRow[]; date?: string } | AttendanceRow[];
}

export const getAttendanceByDateTool: ToolDefinition<
  typeof schema,
  AttendanceByDateResult
> = {
  name: "get_attendance_by_date",
  title:
    "Get attendance for a single date — every employee's check-in/out + late/productive time",
  description:
    "Returns attendance records for every employee in the tenant on one specific date. Each " +
    "record includes the employee's name, biometric/manual ID, check-in time, check-out time, " +
    "status, late flag + seconds, and productive seconds for the day. Optionally filter to one " +
    "department. " +
    "\n\nUNDERSTANDING THE FLOW: Backend reads the date from the query string (?date=...) " +
    "and defaults to today when omitted. Non-admin/department-scoped callers see only their " +
    "department server-side. Source mixes biometric ESSL records and manual check-ins; " +
    "biometric users are matched by essl_id, manual ones by user_id. " +
    "\n\nUSE THIS TOOL TO: answer 'who's present today?', 'who was absent yesterday?', or " +
    "'show today's late arrivals'. For a multi-day window use get_attendance_range; for one " +
    "employee's daily log over a range use get_employee_attendance_details.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "2.0.0", tags: ["attendance"] },

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

    const qs = input.date
      ? `?${new URLSearchParams({ date: input.date }).toString()}`
      : "";

    const res = await apiPost<AttendanceResponse>(
      `${SERVICE.ATTENDANCE}/getEmployeeAttendance${qs}`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    const payload = res.data;
    let records: AttendanceRow[] = [];
    let resolvedDate: string | null = input.date ?? null;

    if (Array.isArray(payload)) {
      records = payload;
    } else if (payload && typeof payload === "object") {
      records = payload.records ?? [];
      resolvedDate = payload.date ?? resolvedDate;
    }

    return {
      date: resolvedDate,
      total: records.length,
      records,
    };
  },
};

toolRegistry.register(getAttendanceByDateTool);
