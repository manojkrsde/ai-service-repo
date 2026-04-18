import { z } from "zod";

import { attendancePost } from "../../../../helpers/attendance.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  employee_id: z.number().int().positive().describe("ID of the employee"),
  year: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional()
    .describe("Year to check balance for (defaults to current year)"),
});

interface LeaveBalanceEntry {
  leave_type: string;
  allocated: number;
  used: number;
  pending: number;
  remaining: number;
}

interface LeaveBalanceResult {
  employee_id: number;
  year: number | null;
  balances: LeaveBalanceEntry[];
}

interface LeaveBalanceResponse {
  data?: LeaveBalanceEntry[];
  year?: number;
}

export const getLeaveBalanceTool: ToolDefinition<
  typeof schema,
  LeaveBalanceResult
> = {
  name: "get_leave_balance",
  title: "Get Leave Balance",
  description:
    "Returns the remaining leave balance for an employee by leave type. " +
    "Use to answer: How many casual leaves does John have left? What is the remaining leave balance?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leave", "attendance"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = { employee_id: input.employee_id };
    if (input.year !== undefined) body["year"] = input.year;

    const res = await attendancePost<LeaveBalanceResponse>(
      "/getLeaveBalance",
      body,
      ctx,
    );

    return {
      employee_id: input.employee_id,
      year: res.year ?? input.year ?? null,
      balances: res.data ?? [],
    };
  },
};

toolRegistry.register(getLeaveBalanceTool);
