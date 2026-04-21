import { z } from "zod";

import { attendancePost } from "../../../../helpers/attendance.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  start_date: z.string().describe("Report start date in YYYY-MM-DD format"),
  end_date: z.string().describe("Report end date in YYYY-MM-DD format"),
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
    .describe("Group report rows by this dimension"),
});

interface ReportRow {
  group_key: string | number;
  group_label: string;
  working_days: number;
  present: number;
  absent: number;
  half_day: number;
  work_from_home: number;
  late: number;
  attendance_pct: number;
}

interface AttendanceReportResult {
  start_date: string;
  end_date: string;
  group_by: string;
  rows: ReportRow[];
}

interface EmployeeBlock {
  employee_info: {
    name?: string;
    employee_id?: string;
    user_id?: number;
    department?: number | string;
  };
  report_period?: { total_working_days?: number };
  attendance_summary: {
    total_present: number;
    total_absent: number;
    total_leaves: number;
    total_late: number;
    attendance_percentage: number | string;
  };
  daily_attendance: Array<{ date: string; status: string; is_late: boolean }>;
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

export const attendanceReportTool: ToolDefinition<
  typeof schema,
  AttendanceReportResult
> = {
  name: "attendance_report",
  title: "Attendance Report",
  description:
    "Generates a detailed attendance report grouped by employee, department, or date. " +
    "Use to answer: What is the monthly attendance report? Which employees were frequently absent?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["reports", "attendance"] },

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

    const res = await attendancePost<DetailedReportResponse>(
      `/getAllEmployeesDetailedAttendanceReport?${qs}`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    const departments = res.data?.department_reports ?? [];
    const globalWorkingDays = res.data?.report_period?.total_working_days ?? 0;

    const employees = departments.flatMap((d) =>
      d.employees.map((e) => ({ dept: d, emp: e })),
    );

    const scoped =
      input.employee_id !== undefined
        ? employees.filter(({ emp }) => emp.employee_info.user_id === input.employee_id)
        : employees;

    const rows: ReportRow[] = buildRows(
      scoped,
      globalWorkingDays,
      input.group_by,
    );

    return {
      start_date: input.start_date,
      end_date: input.end_date,
      group_by: input.group_by,
      rows,
    };
  },
};

function buildRows(
  scoped: Array<{ dept: DepartmentBlock; emp: EmployeeBlock }>,
  globalWorkingDays: number,
  groupBy: "employee" | "department" | "date",
): ReportRow[] {
  if (groupBy === "employee") {
    return scoped.map(({ emp }) => {
      const workingDays = emp.report_period?.total_working_days ?? globalWorkingDays;
      return {
        group_key: emp.employee_info.user_id ?? emp.employee_info.employee_id ?? "unknown",
        group_label: emp.employee_info.name ?? "Unknown",
        working_days: workingDays,
        present: emp.attendance_summary.total_present,
        absent: emp.attendance_summary.total_absent,
        half_day: 0,
        work_from_home: 0,
        late: emp.attendance_summary.total_late,
        attendance_pct: toNumber(emp.attendance_summary.attendance_percentage),
      };
    });
  }

  if (groupBy === "department") {
    const scopedByDept = new Map<string, { dept: DepartmentBlock; emps: EmployeeBlock[] }>();
    for (const { dept, emp } of scoped) {
      const key = String(dept.department_id);
      let entry = scopedByDept.get(key);
      if (!entry) {
        entry = { dept, emps: [] };
        scopedByDept.set(key, entry);
      }
      entry.emps.push(emp);
    }

    return Array.from(scopedByDept.values()).map(({ dept, emps }) => {
      const totals = emps.reduce(
        (acc, e) => {
          acc.present += e.attendance_summary.total_present;
          acc.absent += e.attendance_summary.total_absent;
          acc.late += e.attendance_summary.total_late;
          acc.workingDays +=
            e.report_period?.total_working_days ?? globalWorkingDays;
          return acc;
        },
        { present: 0, absent: 0, late: 0, workingDays: 0 },
      );
      const pct =
        totals.workingDays > 0 ? (totals.present / totals.workingDays) * 100 : 0;
      return {
        group_key: dept.department_id,
        group_label: dept.department_name,
        working_days: totals.workingDays,
        present: totals.present,
        absent: totals.absent,
        half_day: 0,
        work_from_home: 0,
        late: totals.late,
        attendance_pct: Number(pct.toFixed(2)),
      };
    });
  }

  const byDate = new Map<
    string,
    { total: number; present: number; absent: number; late: number }
  >();
  for (const { emp } of scoped) {
    for (const day of emp.daily_attendance) {
      let bucket = byDate.get(day.date);
      if (!bucket) {
        bucket = { total: 0, present: 0, absent: 0, late: 0 };
        byDate.set(day.date, bucket);
      }
      bucket.total++;
      if (day.status === "Present") bucket.present++;
      else if (day.status === "Absent") bucket.absent++;
      if (day.is_late) bucket.late++;
    }
  }

  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => {
      const pct = stats.total > 0 ? (stats.present / stats.total) * 100 : 0;
      return {
        group_key: date,
        group_label: date,
        working_days: stats.total,
        present: stats.present,
        absent: stats.absent,
        half_day: 0,
        work_from_home: 0,
        late: stats.late,
        attendance_pct: Number(pct.toFixed(2)),
      };
    });
}

function toNumber(v: number | string): number {
  if (typeof v === "number") return v;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

toolRegistry.register(attendanceReportTool);
