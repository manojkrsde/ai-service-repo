import { z } from "zod";

import { attendancePost } from "../../../../helpers/attendance.client.js";
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

interface SummaryResponse {
  data?: SummaryRow[];
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
    const body: Record<string, unknown> = {
      start_date: input.start_date,
      end_date: input.end_date,
      group_by: input.group_by,
    };
    if (input.department_id !== undefined) body["department_id"] = input.department_id;
    if (input.employee_id !== undefined) body["employee_id"] = input.employee_id;

    const res = await attendancePost<SummaryResponse>(
      "/getAttendanceSummary",
      body,
      ctx,
    );

    return {
      start_date: input.start_date,
      end_date: input.end_date,
      group_by: input.group_by,
      rows: res.data ?? [],
    };
  },
};

toolRegistry.register(getAttendanceSummaryTool);
