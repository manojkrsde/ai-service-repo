import { z } from "zod";

import { attendancePost } from "../../../../helpers/attendance.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  leave_id: z.number().int().positive().describe("ID of the leave application to approve"),
  comment: z.string().optional().describe("Optional approval comment"),
});

interface ApproveLeaveResult {
  leave_id: number;
  status: string;
  message: string;
}

interface LeaveResponse {
  message?: string;
  data?: { status?: string };
}

export const approveLeaveTool: ToolDefinition<typeof schema, ApproveLeaveResult> = {
  name: "approve_leave",
  title: "Approve Leave",
  description:
    "Approves a pending leave application. " +
    "Use when a manager wants to approve an employee's leave request.",
  inputSchema: schema,
  annotations: { readOnlyHint: false },
  meta: { version: "1.0.0", tags: ["leave", "attendance"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = { leave_id: input.leave_id };
    if (input.comment !== undefined) body["comment"] = input.comment;

    const res = await attendancePost<LeaveResponse>("/approveLeave", body, ctx);

    return {
      leave_id: input.leave_id,
      status: res.data?.status ?? "approved",
      message: res.message ?? "Leave approved",
    };
  },
};

toolRegistry.register(approveLeaveTool);
