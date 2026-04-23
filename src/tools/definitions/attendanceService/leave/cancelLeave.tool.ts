import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  leave_id: z.number().int().positive().describe("ID of the leave application to cancel"),
  reason: z.string().optional().describe("Optional reason for cancellation"),
});

interface CancelLeaveResult {
  leave_id: number;
  status: string;
  message: string;
}

interface LeaveResponse {
  message?: string;
  data?: { status?: string };
}

export const cancelLeaveTool: ToolDefinition<typeof schema, CancelLeaveResult> = {
  name: "cancel_leave",
  title: "Cancel Leave",
  description:
    "Cancels an approved or pending leave application. " +
    "Use when an employee wants to withdraw their leave request.",
  inputSchema: schema,
  annotations: { readOnlyHint: false },
  meta: { version: "1.0.0", tags: ["leave", "attendance"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = { leave_id: input.leave_id };
    if (input.reason !== undefined) body["reason"] = input.reason;

    const res = await apiPost<LeaveResponse>(`${SERVICE.ATTENDANCE}/cancelLeave`, body, ctx);

    return {
      leave_id: input.leave_id,
      status: res.data?.status ?? "cancelled",
      message: res.message ?? "Leave cancelled",
    };
  },
};

toolRegistry.register(cancelLeaveTool);
