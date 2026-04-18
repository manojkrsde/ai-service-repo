import { z } from "zod";

import { attendancePost } from "../../../../helpers/attendance.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  employee_id: z.number().int().positive().describe("ID of the employee applying for leave"),
  leave_type: z.string().describe("Type of leave (e.g. casual, sick, earned, maternity)"),
  start_date: z.string().describe("Leave start date in YYYY-MM-DD format"),
  end_date: z.string().describe("Leave end date in YYYY-MM-DD format"),
  reason: z.string().describe("Reason for the leave request"),
  half_day: z.boolean().default(false).describe("True if requesting only half a day"),
});

interface ApplyLeaveResult {
  leave_id: number | null;
  employee_id: number;
  leave_type: string;
  start_date: string;
  end_date: string;
  status: string;
  message: string;
}

interface LeaveResponse {
  data?: { id?: number; status?: string };
  message?: string;
}

export const applyLeaveTool: ToolDefinition<typeof schema, ApplyLeaveResult> = {
  name: "apply_leave",
  title: "Apply Leave",
  description:
    "Submits a leave application for an employee. " +
    "Use when an employee wants to request time off.",
  inputSchema: schema,
  annotations: { readOnlyHint: false },
  meta: { version: "1.0.0", tags: ["leave", "attendance"] },

  handler: async (input, ctx) => {
    const res = await attendancePost<LeaveResponse>(
      "/applyLeave",
      {
        employee_id: input.employee_id,
        leave_type: input.leave_type,
        start_date: input.start_date,
        end_date: input.end_date,
        reason: input.reason,
        half_day: input.half_day,
      },
      ctx,
    );

    return {
      leave_id: res.data?.id ?? null,
      employee_id: input.employee_id,
      leave_type: input.leave_type,
      start_date: input.start_date,
      end_date: input.end_date,
      status: res.data?.status ?? "pending",
      message: res.message ?? "Leave application submitted",
    };
  },
};

toolRegistry.register(applyLeaveTool);
