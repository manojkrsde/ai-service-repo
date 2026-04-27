/**
 * Detailed attendance report across all employees, grouped by department.
 *
 * Wraps POST /getAllEmployeesDetailedAttendanceReport. Backend body requires
 * c_id + c_type (strict); department_id optional. startDate + endDate are
 * read from `req.query` and required.
 *
 * Response shape (controller-generated):
 *   { data: { report_period: { total_working_days }, department_reports: [
 *       { department_id, department_name, employees: [
 *         { employee_info: { user_id, name, employee_id }, report_period,
 *           attendance_summary: { total_present, total_absent, total_leaves, attendance_percentage },
 *           daily_attendance: [{ date, status }] } ] } ] } }
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  start_date: z
    .string()
    .describe("Start of the reporting window in YYYY-MM-DD."),
  end_date: z
    .string()
    .describe("End of the reporting window in YYYY-MM-DD."),
  department_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Restrict the report to one department. Use list_departments to discover IDs.",
    ),
});

interface EmployeeBlock {
  employee_info: {
    user_id?: number;
    employee_id?: string;
    name?: string;
  };
  report_period?: { total_working_days?: number };
  attendance_summary: {
    total_present: number;
    total_absent: number;
    total_leaves: number;
    attendance_percentage: number | string;
  };
  daily_attendance: Array<{ date: string; status: string }>;
}

interface DepartmentBlock {
  department_id: number | string;
  department_name: string;
  employees: EmployeeBlock[];
}

interface AttendanceReportResult {
  start_date: string;
  end_date: string;
  total_working_days: number;
  total_employees: number;
  departments: DepartmentBlock[];
}

interface DetailedReportResponse {
  data?: {
    report_period?: { total_working_days?: number };
    department_reports?: DepartmentBlock[];
  };
}

export const getAttendanceReportTool: ToolDefinition<
  typeof schema,
  AttendanceReportResult
> = {
  name: "get_attendance_report",
  title:
    "Get detailed attendance report — per-department, per-employee, with daily status",
  description:
    "Returns the full detailed attendance report for the tenant over a date window. The " +
    "report is grouped by department, and within each department by employee. Every employee " +
    "block includes a per-day status timeline (Present / Absent / Holiday / Leave) plus a " +
    "rolled-up attendance_summary with total_present, total_absent, total_leaves, and " +
    "attendance_percentage. The top-level report_period.total_working_days is the working-day " +
    "count after holidays + Sundays. " +
    "\n\nUNDERSTANDING THE FLOW: Backend reads start_date and end_date from the query string; " +
    "they are required (it returns HTTP 400 if either is missing). Non-admin/department-scoped " +
    "callers see only their department server-side. Optional department_id narrows further. " +
    "\n\nUSE THIS TOOL TO: build a 'department-wise attendance for July' view, find the " +
    "lowest-attendance employees, or export a periodic attendance audit. For dashboard-style " +
    "headline metrics with growth deltas use get_attendance_stats; for one employee's daily " +
    "log use get_employee_attendance_details.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["attendance", "report"] },

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

    const res = await apiPost<DetailedReportResponse>(
      `${SERVICE.ATTENDANCE}/getAllEmployeesDetailedAttendanceReport?${qs}`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    const departments = res.data?.department_reports ?? [];
    const totalEmployees = departments.reduce(
      (sum, d) => sum + (d.employees?.length ?? 0),
      0,
    );

    return {
      start_date: input.start_date,
      end_date: input.end_date,
      total_working_days: res.data?.report_period?.total_working_days ?? 0,
      total_employees: totalEmployees,
      departments,
    };
  },
};

toolRegistry.register(getAttendanceReportTool);
