import { z } from "zod";

import { attendancePost } from "../../../../helpers/attendance.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  date: z.string().describe("Date in YYYY-MM-DD format"),
  department_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Filter by department ID"),
  employee_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Filter to a specific employee"),
});

interface AttendanceRecord {
  attendance_id: number;
  employee_id: number;
  employee_name: string;
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
}

interface AttendanceByDateResult {
  date: string;
  total: number;
  records: AttendanceRecord[];
}

interface AttendanceResponse {
  data?: AttendanceRecord[];
}

export const getAttendanceByDateTool: ToolDefinition<
  typeof schema,
  AttendanceByDateResult
> = {
  name: "get_attendance_by_date",
  title: "Get Attendance by Date",
  description:
    "Returns attendance records for all employees (or a specific department/employee) on a given date. " +
    "Use to answer: Who was absent on Monday? What is today's attendance?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["attendance"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = { date: input.date };
    if (input.department_id !== undefined) body["department_id"] = input.department_id;
    if (input.employee_id !== undefined) body["employee_id"] = input.employee_id;

    const res = await attendancePost<AttendanceResponse>(
      "/getAttendanceByDate",
      body,
      ctx,
    );

    const records = res.data ?? [];
    return { date: input.date, total: records.length, records };
  },
};

toolRegistry.register(getAttendanceByDateTool);
