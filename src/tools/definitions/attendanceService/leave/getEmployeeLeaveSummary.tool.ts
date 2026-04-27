/**
 * Admin/EmployeeAdmin lookup of any employee's leave balance + history.
 *
 * Wraps POST /get-employee-leave-summary. Backend body accepts:
 *   employeeId (number, required), status?, leaveTypeId?, startDate?,
 *   endDate?, page?, limit? (default 30, max 100). Strict.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  employee_id: z
    .number()
    .int()
    .positive()
    .describe(
      "Employee user ID to look up. Use list_employees to discover IDs.",
    ),
  status: z
    .enum(["approved", "pending", "rejected", "cancelled", "all"])
    .optional()
    .describe("Filter the history to one status (or 'all' for everything)."),
  leave_type_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Filter the history to one leave type."),
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
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number (1-based) for the leaveHistory list."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(30)
    .describe("Records per page for leaveHistory (max 100)."),
});

interface EmployeeLeaveSummaryResult {
  employee_id: number;
  employee_info: unknown;
  balances: unknown;
  history: unknown;
  pagination: unknown;
  summary_stats: unknown;
}

interface EmployeeSummaryResponse {
  data?: {
    employeeInfo?: unknown;
    leaveBalances?: unknown;
    leaveHistory?: unknown;
    pagination?: unknown;
    summaryStats?: unknown;
  };
}

export const getEmployeeLeaveSummaryTool: ToolDefinition<
  typeof schema,
  EmployeeLeaveSummaryResult
> = {
  name: "get_employee_leave_summary",
  title:
    "Get an employee's leave summary — balances + history with paginated filters (admin)",
  description:
    "Admin-facing lookup of any single employee's leave balances and request history. Returns " +
    "the employee's profile (name, email, mobile, department, designation, joining date), " +
    "per-leave-type balances, paginated leave history filtered by status / leave type / date " +
    "range, plus rolled-up summary statistics. " +
    "\n\nUNDERSTANDING THE FLOW: Backend defaults the date window to the current calendar " +
    "month. The endpoint is intended for Admin / EmployeeAdmin use; non-admin callers will " +
    "be permission-denied server-side. " +
    "\n\nUSE THIS TOOL TO: review one specific employee's leave situation, audit a member's " +
    "applications before approving, or build an employee leave-card view. For the calling " +
    "user's own summary use get_leave_summary; for a tenant-wide overview use " +
    "get_company_leave_overview.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leave", "admin"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      employeeId: input.employee_id,
      page: input.page,
      limit: input.limit,
    };
    if (input.status !== undefined) body["status"] = input.status;
    if (input.leave_type_id !== undefined) body["leaveTypeId"] = input.leave_type_id;
    if (input.start_date) body["startDate"] = input.start_date;
    if (input.end_date) body["endDate"] = input.end_date;

    const res = await apiPost<EmployeeSummaryResponse>(
      `${SERVICE.ATTENDANCE}/get-employee-leave-summary`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    return {
      employee_id: input.employee_id,
      employee_info: res.data?.employeeInfo ?? null,
      balances: res.data?.leaveBalances ?? null,
      history: res.data?.leaveHistory ?? null,
      pagination: res.data?.pagination ?? null,
      summary_stats: res.data?.summaryStats ?? null,
    };
  },
};

toolRegistry.register(getEmployeeLeaveSummaryTool);
