import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  leave_id: z.number().int().positive().describe("ID of the leave application to reject"),
  reason: z.string().describe("Reason for rejecting the leave request"),
});

interface RejectLeaveResult {
  leave_id: number;
  status: string;
  message: string;
}

interface LeaveResponse {
  message?: string;
  data?: { status?: string };
}

export const rejectLeaveTool: ToolDefinition<typeof schema, RejectLeaveResult> = {
  name: "reject_leave",
  title: "Reject Leave",
  description:
    "Rejects a pending leave application with a reason. " +
    "Use when a manager needs to deny an employee's leave request.",
  inputSchema: schema,
  annotations: { readOnlyHint: false },
  meta: { version: "1.0.0", tags: ["leave", "attendance"] },

  handler: async (input, ctx) => {
    const res = await apiPost<LeaveResponse>(`${SERVICE.ATTENDANCE}/rejectLeave`,
      { leave_id: input.leave_id, reason: input.reason },
      ctx,
    );

    return {
      leave_id: input.leave_id,
      status: res.data?.status ?? "rejected",
      message: res.message ?? "Leave rejected",
    };
  },
};

toolRegistry.register(rejectLeaveTool);
