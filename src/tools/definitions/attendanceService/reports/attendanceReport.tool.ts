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

interface ReportResponse {
  data?: ReportRow[];
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
    const body: Record<string, unknown> = {
      start_date: input.start_date,
      end_date: input.end_date,
      group_by: input.group_by,
    };
    if (input.department_id !== undefined) body["department_id"] = input.department_id;
    if (input.employee_id !== undefined) body["employee_id"] = input.employee_id;

    const res = await attendancePost<ReportResponse>("/attendanceReport", body, ctx);

    return {
      start_date: input.start_date,
      end_date: input.end_date,
      group_by: input.group_by,
      rows: res.data ?? [],
    };
  },
};

toolRegistry.register(attendanceReportTool);
