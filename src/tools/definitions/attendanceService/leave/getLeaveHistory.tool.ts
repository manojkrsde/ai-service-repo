import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  employee_id: z.number().int().positive().describe("ID of the employee"),
  start_date: z.string().optional().describe("Filter from this date (YYYY-MM-DD)"),
  end_date: z.string().optional().describe("Filter to this date (YYYY-MM-DD)"),
  status: z
    .enum(["all", "pending", "approved", "rejected", "cancelled"])
    .default("all")
    .describe("Filter by leave application status"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum records to return"),
});

interface LeaveRecord {
  leave_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  reason: string;
  applied_at: string;
}

interface LeaveHistoryResult {
  employee_id: number;
  total: number;
  returned: number;
  records: LeaveRecord[];
}

interface LeaveHistoryResponse {
  data?: LeaveRecord[];
  total?: number;
}

export const getLeaveHistoryTool: ToolDefinition<
  typeof schema,
  LeaveHistoryResult
> = {
  name: "get_leave_history",
  title: "Get Leave History",
  description:
    "Returns the leave application history for an employee. " +
    "Use to answer: What leaves has John taken this year? Are there any pending leave requests?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leave", "attendance"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      employee_id: input.employee_id,
      limit: input.limit,
    };
    if (input.start_date !== undefined) body["start_date"] = input.start_date;
    if (input.end_date !== undefined) body["end_date"] = input.end_date;
    if (input.status !== "all") body["status"] = input.status;

    const res = await apiPost<LeaveHistoryResponse>(`${SERVICE.ATTENDANCE}/getLeaveHistory`,
      body,
      ctx,
    );

    const records = res.data ?? [];
    return {
      employee_id: input.employee_id,
      total: res.total ?? records.length,
      returned: records.length,
      records,
    };
  },
};

toolRegistry.register(getLeaveHistoryTool);
