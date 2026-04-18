import { z } from "zod";

import { attendancePost } from "../../../../helpers/attendance.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  employee_id: z.number().int().positive().describe("ID of the employee"),
  leave_type: z.string().describe("Type of leave to adjust (e.g. casual, sick, earned)"),
  adjustment: z
    .number()
    .describe("Number of days to add (positive) or deduct (negative) from the balance"),
  reason: z.string().describe("Reason for the manual balance adjustment"),
  year: z
    .number()
    .int()
    .min(2000)
    .max(2100)
    .optional()
    .describe("Year for which to adjust balance (defaults to current year)"),
});

interface UpdateLeaveBalanceResult {
  employee_id: number;
  leave_type: string;
  adjustment: number;
  new_balance: number | null;
  message: string;
}

interface UpdateBalanceResponse {
  message?: string;
  data?: { balance?: number };
}

export const updateLeaveBalanceTool: ToolDefinition<
  typeof schema,
  UpdateLeaveBalanceResult
> = {
  name: "update_leave_balance",
  title: "Update Leave Balance",
  description:
    "Manually adjusts an employee's leave balance for a given leave type. " +
    "Use when an admin needs to credit extra leaves or correct an incorrect balance.",
  inputSchema: schema,
  annotations: { readOnlyHint: false },
  meta: { version: "1.0.0", tags: ["leave", "attendance"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      employee_id: input.employee_id,
      leave_type: input.leave_type,
      adjustment: input.adjustment,
      reason: input.reason,
    };
    if (input.year !== undefined) body["year"] = input.year;

    const res = await attendancePost<UpdateBalanceResponse>(
      "/updateLeaveBalance",
      body,
      ctx,
    );

    return {
      employee_id: input.employee_id,
      leave_type: input.leave_type,
      adjustment: input.adjustment,
      new_balance: res.data?.balance ?? null,
      message: res.message ?? "Leave balance updated",
    };
  },
};

toolRegistry.register(updateLeaveBalanceTool);
