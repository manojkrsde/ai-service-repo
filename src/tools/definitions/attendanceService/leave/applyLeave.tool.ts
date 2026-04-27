/**
 * Submits (or edits) a leave request for the calling user.
 *
 * Wraps POST /apply-leave (controller `applyForLeave`). Backend middleware
 * is strict and requires:
 *   leaveTypeId (number), startDate, endDate, reason, days (number),
 *   startDayPart, endDayPart.
 * Optional: leaveRequestId (when editing an existing request),
 * isPlanned, documents.
 *
 * The applying user is always the caller — backend reads `req.userId` from
 * the JWT and cannot be overridden via the body.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const DAY_PART = z.enum(["full", "first_half", "second_half"]);

const schema = z.object({
  leave_type_id: z
    .number()
    .int()
    .positive()
    .describe(
      "ID of the leave type (e.g. casual, sick). Use get_leave_types to discover available IDs.",
    ),
  start_date: z.string().describe("Leave start date in YYYY-MM-DD."),
  end_date: z.string().describe("Leave end date in YYYY-MM-DD (inclusive)."),
  reason: z.string().trim().min(1).describe("Non-empty reason for the leave."),
  days: z
    .number()
    .min(0.5)
    .describe(
      "Total leave days being requested. Must be in multiples of 0.5 unless this is a Short Leave (then exactly 1).",
    ),
  start_day_part: DAY_PART.default("full").describe(
    "Which part of the start date the leave covers: 'full' (whole day), 'first_half', or 'second_half'.",
  ),
  end_day_part: DAY_PART.default("full").describe(
    "Which part of the end date the leave covers: 'full' (whole day), 'first_half', or 'second_half'.",
  ),
  is_planned: z
    .boolean()
    .default(true)
    .describe(
      "True for planned leave, false for unplanned (e.g. emergency sick leave).",
    ),
  documents: z
    .array(z.unknown())
    .optional()
    .describe(
      "Optional supporting documents (typically uploaded-file metadata objects).",
    ),
  leave_request_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "When set, edits the existing leave request with this ID instead of creating a new one. Get the ID from get_leave_summary or get_employee_leave_summary.",
    ),
});

interface ApplyLeaveResult {
  success: boolean;
  leave_request_id: number | null;
  message: string;
}

interface ApplyLeaveResponse {
  message: {
    message: string;
    leaveRequest: {
      id: number;
      status: string;
      leaveTypeId: number;
      startDate: string;
      endDate: string;
      startDayPart: string;
      endDayPart: string;
    };
  };
}

function extractMessage(res: ApplyLeaveResponse | undefined): string {
  if (!res) return "";
  if (typeof res === "object") return res?.message?.message;
  return "";
}

function extractLeaveId(res: ApplyLeaveResponse | undefined): number | null {
  if (!res) return null;
  return res.message?.leaveRequest?.id;
}

export const applyLeaveTool: ToolDefinition<typeof schema, ApplyLeaveResult> = {
  name: "apply_leave",
  title:
    "Apply for leave — submit a new leave request (or edit an existing one)",
  description:
    "Submits a new leave request for the calling user, or edits an existing one when " +
    "leave_request_id is set. Backend validates the date range, the day-part combination, the " +
    "balance against the chosen leave type, and applies leave-type-specific rules (e.g. Short " +
    "Leave must be exactly 1 day, monthly-accrual types can't be requested for future months). " +
    "\n\nUNDERSTANDING THE FLOW: The applying user is always the calling user — there is no " +
    "way to apply leave on behalf of someone else through this endpoint. Use get_leave_types " +
    "first to resolve a leave-type ID. days must be in multiples of 0.5 (a half-day is 0.5). " +
    "Use start_day_part/end_day_part to indicate when on the boundary days the leave actually " +
    "starts and ends ('full', 'first_half', 'second_half'). " +
    "\n\nUSE THIS TOOL TO: file a new leave request, or edit a previously-filed one (pass " +
    "leave_request_id). For status changes (approve/reject/cancel) use update_leave_status. " +
    "\n\nNOTE: Backend rejects empty reasons, mismatched day counts, and end-before-start " +
    "ranges with HTTP 400 + a specific error message — surface it to the user verbatim.",
  inputSchema: schema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  meta: { version: "2.0.0", tags: ["leave", "action"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      leaveTypeId: input.leave_type_id,
      startDate: input.start_date,
      endDate: input.end_date,
      reason: input.reason,
      days: input.days,
      startDayPart: input.start_day_part,
      endDayPart: input.end_day_part,
      isPlanned: input.is_planned,
    };
    if (input.documents !== undefined) body["documents"] = input.documents;
    if (input.leave_request_id !== undefined) {
      body["leaveRequestId"] = input.leave_request_id;
    }

    const res = await apiPost<ApplyLeaveResponse>(
      `${SERVICE.ATTENDANCE}/apply-leave`,
      body,
      ctx,
      { injectCompanyContext: false },
    );
    return {
      success: true,
      leave_request_id: extractLeaveId(res) ?? input.leave_request_id ?? null,
      message: extractMessage(res) || "Leave request submitted",
      data: res.message?.leaveRequest,
    };
  },
};

toolRegistry.register(applyLeaveTool);
