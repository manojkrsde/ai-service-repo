/**
 * The calling user's leave balance + leave history for a date range.
 *
 * Wraps POST /leave-summary. Backend body accepts only signature +
 * leaveTypeId? + status? + startDate? + endDate? (strict). When the date
 * range is omitted, backend defaults to the current calendar month.
 *
 * Returns both `leaveBalances` (per leave type, with running monthly
 * accruals) and `leaveHistory` (the user's filed requests in the window).
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  start_date: z
    .string()
    .optional()
    .describe(
      "Start of date range in YYYY-MM-DD. Defaults to first of current month when omitted.",
    ),
  end_date: z
    .string()
    .optional()
    .describe(
      "End of date range in YYYY-MM-DD. Defaults to end of current month when omitted.",
    ),
  leave_type_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Filter the history to one leave type. Use get_leave_types to discover IDs.",
    ),
  status: z
    .enum(["approved", "pending", "rejected", "cancelled"])
    .optional()
    .describe("Filter the history to one status."),
});

interface LeaveSummaryResult {
  start_date: string | null;
  end_date: string | null;
  balances: unknown;
  history: unknown;
}

interface LeaveSummaryResponse {
  data?: {
    leaveBalances?: unknown;
    leaveHistory?: unknown;
  };
}

export const getLeaveSummaryTool: ToolDefinition<
  typeof schema,
  LeaveSummaryResult
> = {
  name: "get_leave_summary",
  title:
    "Get my leave summary — balances per leave type + leave history in a date range",
  description:
    "Returns the calling user's leave summary for a date range: `balances` (per leave type — " +
    "name, balance, used, monthly accrual breakdown when applicable) and `history` (filed " +
    "requests in the window with their current status, dates, days, and reason). " +
    "\n\nUNDERSTANDING THE FLOW: Backend defaults to the current calendar month if both dates " +
    "are omitted. The endpoint is per-caller — there is no employee_id input here. To inspect " +
    "another user's leaves use get_employee_leave_summary (admin), or to see the whole " +
    "company use get_company_leave_overview. " +
    "\n\nUSE THIS TOOL TO: answer 'how many casual leaves do I have left?', 'show my leaves " +
    "this month', 'what's the status of my recent applications?'. " +
    "\n\nNOTE: Backend pre-computes per-leave-type monthly accruals server-side; surface the " +
    "balances and history blocks as-is for the LLM to render.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leave"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {};
    if (input.start_date) body["startDate"] = input.start_date;
    if (input.end_date) body["endDate"] = input.end_date;
    if (input.leave_type_id !== undefined) body["leaveTypeId"] = input.leave_type_id;
    if (input.status !== undefined) body["status"] = input.status;

    const res = await apiPost<LeaveSummaryResponse>(
      `${SERVICE.ATTENDANCE}/leave-summary`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    return {
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      balances: res.data?.leaveBalances ?? null,
      history: res.data?.leaveHistory ?? null,
    };
  },
};

toolRegistry.register(getLeaveSummaryTool);
