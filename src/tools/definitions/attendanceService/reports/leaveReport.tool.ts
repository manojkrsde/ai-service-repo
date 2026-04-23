import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
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
  leave_type: z.string().optional().describe("Filter by a specific leave type"),
  status: z
    .enum(["all", "pending", "approved", "rejected", "cancelled"])
    .default("approved")
    .describe("Filter by leave application status"),
});

interface LeaveReportRow {
  employee_id: number;
  employee_name: string;
  leave_type: string;
  days_taken: number;
  balance_remaining: number;
}

interface LeaveReportResult {
  start_date: string;
  end_date: string;
  status_filter: string;
  total_employees: number;
  rows: LeaveReportRow[];
}

interface ReportResponse {
  data?: LeaveReportRow[];
}

export const leaveReportTool: ToolDefinition<
  typeof schema,
  LeaveReportResult
> = {
  name: "leave_report",
  title: "Leave Report",
  description:
    "Generates a leave utilisation report for a date range, optionally filtered by department or leave type. " +
    "Use to answer: How many leaves were taken this quarter? Who used the most sick leaves?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["reports", "leave", "attendance"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      start_date: input.start_date,
      end_date: input.end_date,
      status: input.status,
    };
    if (input.department_id !== undefined) body["department_id"] = input.department_id;
    if (input.leave_type !== undefined) body["leave_type"] = input.leave_type;

    const res = await apiPost<ReportResponse>(`${SERVICE.ATTENDANCE}/leaveReport`, body, ctx);

    const rows = res.data ?? [];
    return {
      start_date: input.start_date,
      end_date: input.end_date,
      status_filter: input.status,
      total_employees: rows.length,
      rows,
    };
  },
};

toolRegistry.register(leaveReportTool);
