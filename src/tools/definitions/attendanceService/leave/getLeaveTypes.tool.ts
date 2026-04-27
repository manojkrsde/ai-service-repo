/**
 * Lists the leave types the calling user is eligible to apply for.
 *
 * Wraps POST /get-leave-types. Backend body accepts only signature +
 * company_id? + company_type? (strict). Backend returns the active leave
 * types matching the caller's gender; Admin callers also see inactive
 * types.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface LeaveTypeRow {
  id?: number;
  name?: string;
  category?: string;
  balance?: number;
  isActive?: boolean;
  carryForwardAllowed?: boolean;
  carryForwardLimit?: number;
  eligibleGender?: string;
  eligibleEmploymentType?: string;
  minimumServiceMonths?: number;
  requiresApproval?: boolean;
  description?: string;
  isMonthlyAccrual?: boolean;
  monthlyAllocation?: number;
  monthlyLimit?: number;
  monthlyCarryForward?: boolean;
}

interface LeaveTypesResult {
  total: number;
  leave_types: LeaveTypeRow[];
}

interface LeaveTypesResponse {
  data?: {
    leaveTypes?: LeaveTypeRow[];
  };
}

export const getLeaveTypesTool: ToolDefinition<
  typeof schema,
  LeaveTypesResult
> = {
  name: "get_leave_types",
  title:
    "Get leave types — every leave type the caller can apply for (id, name, balance, rules)",
  description:
    "Returns the leave types available to the calling user. Each entry includes id, name, " +
    "category (planned, unplanned, casual, sick, earned, maternity, paternity, other, " +
    "unpaid), balance (default allocation; -1 = unlimited), isActive flag, carry-forward " +
    "rules, eligibility (gender, employment type, minimum service months), monthly accrual " +
    "settings, and whether the type requires approval. " +
    "\n\nUNDERSTANDING THE FLOW: Backend filters by the caller's gender and (for non-admin " +
    "callers) only returns isActive=true types. Admins see all types including inactive ones. " +
    "The id returned here is the `leave_type_id` to pass into apply_leave or to filter " +
    "get_leave_summary / get_employee_leave_summary. " +
    "\n\nUSE THIS TOOL TO: discover available leave types before applying for leave, see what " +
    "balance each type has, or check eligibility rules. " +
    "\n\nNOTE: This tool returns the *configured* leave types, not the caller's remaining " +
    "balance. For the caller's actual remaining balance use get_leave_summary.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leave", "config"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<LeaveTypesResponse>(
      `${SERVICE.ATTENDANCE}/get-leave-types`,
      {},
      ctx,
      { injectCompanyContext: false },
    );

    const leaveTypes = res.data?.leaveTypes ?? [];

    return {
      total: leaveTypes.length,
      leave_types: leaveTypes,
    };
  },
};

toolRegistry.register(getLeaveTypesTool);
