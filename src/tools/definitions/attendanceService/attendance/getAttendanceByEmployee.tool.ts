import { z } from "zod";

import { attendancePost } from "../../../../helpers/attendance.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  employee_id: z.number().int().positive().describe("ID of the employee"),
  start_date: z.string().describe("Start of date range in YYYY-MM-DD format"),
  end_date: z.string().describe("End of date range in YYYY-MM-DD format"),
});

interface AttendanceRecord {
  attendance_id: number;
  date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  hours_worked: number | null;
}

interface AttendanceByEmployeeResult {
  employee_id: number;
  start_date: string;
  end_date: string;
  total_days: number;
  present: number;
  absent: number;
  half_day: number;
  work_from_home: number;
  records: AttendanceRecord[];
}

interface AttendanceResponse {
  data?: AttendanceRecord[];
  summary?: {
    present?: number;
    absent?: number;
    half_day?: number;
    work_from_home?: number;
  };
}

export const getAttendanceByEmployeeTool: ToolDefinition<
  typeof schema,
  AttendanceByEmployeeResult
> = {
  name: "get_attendance_by_employee",
  title: "Get Attendance by Employee",
  description:
    "Returns the attendance history for a specific employee over a date range. " +
    "Use to answer: How many days did John attend this month? What is the attendance record for employee 42?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["attendance"] },

  handler: async (input, ctx) => {
    const res = await attendancePost<AttendanceResponse>(
      "/getAttendanceByEmployee",
      {
        employee_id: input.employee_id,
        start_date: input.start_date,
        end_date: input.end_date,
      },
      ctx,
    );

    const records = res.data ?? [];
    const summary = res.summary ?? {};

    const present = summary.present ?? records.filter((r) => r.status === "present").length;
    const absent = summary.absent ?? records.filter((r) => r.status === "absent").length;
    const halfDay = summary.half_day ?? records.filter((r) => r.status === "half_day").length;
    const wfh = summary.work_from_home ?? records.filter((r) => r.status === "work_from_home").length;

    return {
      employee_id: input.employee_id,
      start_date: input.start_date,
      end_date: input.end_date,
      total_days: records.length,
      present,
      absent,
      half_day: halfDay,
      work_from_home: wfh,
      records,
    };
  },
};

toolRegistry.register(getAttendanceByEmployeeTool);
