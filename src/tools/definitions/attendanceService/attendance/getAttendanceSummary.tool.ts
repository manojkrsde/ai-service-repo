import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  start_date: z.string().describe("Start of date range in YYYY-MM-DD format"),
  end_date: z.string().describe("End of date range in YYYY-MM-DD format"),
  department_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Scope to a specific department"),
  employee_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Scope to a specific employee"),
  group_by: z
    .enum(["employee", "department", "date"])
    .default("employee")
    .describe("Dimension to group the summary by"),
});

interface SummaryRow {
  group_key: string | number;
  group_label: string;
  total_days: number;
  present: number;
  absent: number;
  half_day: number;
  work_from_home: number;
  attendance_pct: number;
}

interface AttendanceSummaryResult {
  start_date: string;
  end_date: string;
  group_by: string;
  rows: SummaryRow[];
}

interface EmployeeBlock {
  employee_info: {
    name?: string;
    employee_id?: string;
    user_id?: number;
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

interface DetailedReportData {
  report_period: { total_working_days: number };
  department_reports: DepartmentBlock[];
}

interface DetailedReportResponse {
  data?: DetailedReportData;
}

export const getAttendanceSummaryTool: ToolDefinition<
  typeof schema,
  AttendanceSummaryResult
> = {
  name: "get_attendance_summary",
  title: "Get Attendance Summary",
  description:
    "Returns a grouped attendance summary over a date range. " +
    "Use to answer: What is the department-wise attendance for this month? " +
    "Who has the lowest attendance percentage?",
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

    const res = await apiPost<DetailedReportResponse>(
      `${SERVICE.ATTENDANCE}/getAllEmployeesDetailedAttendanceReport?${qs}`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    const departments = res.data?.department_reports ?? [];
    const globalWorkingDays = res.data?.report_period?.total_working_days ?? 0;

    const pairs = departments.flatMap((d) =>
      d.employees.map((e) => ({ dept: d, emp: e })),
    );
    const scoped =
      input.employee_id !== undefined
        ? pairs.filter(({ emp }) => emp.employee_info.user_id === input.employee_id)
        : pairs;

    const rows = buildSummaryRows(scoped, globalWorkingDays, input.group_by);

    return {
      start_date: input.start_date,
      end_date: input.end_date,
      group_by: input.group_by,
      rows,
    };
  },
};

function buildSummaryRows(
  scoped: Array<{ dept: DepartmentBlock; emp: EmployeeBlock }>,
  globalWorkingDays: number,
  groupBy: "employee" | "department" | "date",
): SummaryRow[] {
  if (groupBy === "employee") {
    return scoped.map(({ emp }) => ({
      group_key: emp.employee_info.user_id ?? emp.employee_info.employee_id ?? "unknown",
      group_label: emp.employee_info.name ?? "Unknown",
      total_days: emp.report_period?.total_working_days ?? globalWorkingDays,
      present: emp.attendance_summary.total_present,
      absent: emp.attendance_summary.total_absent,
      half_day: 0,
      work_from_home: 0,
      attendance_pct: toNumber(emp.attendance_summary.attendance_percentage),
    }));
  }

  if (groupBy === "department") {
    const grouped = new Map<string, { dept: DepartmentBlock; emps: EmployeeBlock[] }>();
    for (const { dept, emp } of scoped) {
      const key = String(dept.department_id);
      let entry = grouped.get(key);
      if (!entry) {
        entry = { dept, emps: [] };
        grouped.set(key, entry);
      }
      entry.emps.push(emp);
    }

    return Array.from(grouped.values()).map(({ dept, emps }) => {
      const totals = emps.reduce(
        (acc, e) => {
          acc.present += e.attendance_summary.total_present;
          acc.absent += e.attendance_summary.total_absent;
          acc.totalDays +=
            e.report_period?.total_working_days ?? globalWorkingDays;
          return acc;
        },
        { present: 0, absent: 0, totalDays: 0 },
      );
      const pct = totals.totalDays > 0 ? (totals.present / totals.totalDays) * 100 : 0;
      return {
        group_key: dept.department_id,
        group_label: dept.department_name,
        total_days: totals.totalDays,
        present: totals.present,
        absent: totals.absent,
        half_day: 0,
        work_from_home: 0,
        attendance_pct: Number(pct.toFixed(2)),
      };
    });
  }

  const byDate = new Map<string, { total: number; present: number; absent: number }>();
  for (const { emp } of scoped) {
    for (const day of emp.daily_attendance) {
      let bucket = byDate.get(day.date);
      if (!bucket) {
        bucket = { total: 0, present: 0, absent: 0 };
        byDate.set(day.date, bucket);
      }
      bucket.total++;
      if (day.status === "Present") bucket.present++;
      else if (day.status === "Absent") bucket.absent++;
    }
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => {
      const pct = stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
      return {
        group_key: date,
        group_label: date,
        total_days: stats.total,
        present: stats.present,
        absent: stats.absent,
        half_day: 0,
        work_from_home: 0,
        attendance_pct: Number(pct.toFixed(2)),
      };
    });
}

function toNumber(v: number | string): number {
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

toolRegistry.register(getAttendanceSummaryTool);
