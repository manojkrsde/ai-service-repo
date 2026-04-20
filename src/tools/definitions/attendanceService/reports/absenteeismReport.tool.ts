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
  threshold_pct: z
    .number()
    .min(0)
    .max(100)
    .default(80)
    .describe(
      "Attendance percentage below which an employee is flagged as high-absenteeism risk",
    ),
});

interface AbsenteeismRow {
  employee_id: number;
  employee_name: string;
  department: string;
  working_days: number;
  days_absent: number;
  attendance_pct: number;
  flagged: boolean;
}

interface AbsenteeismReportResult {
  start_date: string;
  end_date: string;
  threshold_pct: number;
  total_employees: number;
  flagged_count: number;
  rows: AbsenteeismRow[];
}

interface ReportResponse {
  data?: AbsenteeismRow[];
}

export const absenteeismReportTool: ToolDefinition<
  typeof schema,
  AbsenteeismReportResult
> = {
  name: "absenteeism_report",
  title: "Absenteeism Report",
  description:
    "Identifies employees with attendance below a configurable threshold. " +
    "Use to answer: Who has high absenteeism this month? Which employees need an attendance warning?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["reports", "attendance"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      start_date: input.start_date,
      end_date: input.end_date,
      threshold_pct: input.threshold_pct,
    };
    if (input.department_id !== undefined) body["department_id"] = input.department_id;

    const res = await attendancePost<ReportResponse>("/absenteeismReport", body, ctx);

    const rows = res.data ?? [];
    const flaggedCount = rows.filter((r) => r.flagged).length;

    return {
      start_date: input.start_date,
      end_date: input.end_date,
      threshold_pct: input.threshold_pct,
      total_employees: rows.length,
      flagged_count: flaggedCount,
      rows,
    };
  },
};

toolRegistry.register(absenteeismReportTool);
