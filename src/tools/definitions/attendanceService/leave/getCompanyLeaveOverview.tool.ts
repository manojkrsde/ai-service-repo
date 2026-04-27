/**
 * Tenant-wide leave overview for admins.
 *
 * Wraps POST /get-company-leaveOverview. Backend body accepts only
 * companyId? + companyType? (strict). Both default to the caller's
 * company context server-side when omitted. EmployeeAdmin callers see
 * only their department.
 *
 * Returns aggregate stats (totalApplications, pending, approved,
 * rejected, planned, unplanned) plus an enriched leaveHistory list.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface CompanyLeaveOverviewResult {
  stats: unknown;
  leave_history: unknown;
}

interface CompanyOverviewResponse {
  data?: {
    stats?: unknown;
    leaveHistory?: unknown;
  };
}

export const getCompanyLeaveOverviewTool: ToolDefinition<
  typeof schema,
  CompanyLeaveOverviewResult
> = {
  name: "get_company_leave_overview",
  title:
    "Get company leave overview — stats + enriched history of every employee's leaves (admin)",
  description:
    "Returns the tenant-wide leave overview for an admin caller. Includes:\n" +
    "  • stats: { totalApplications, pending, approved, rejected, planned, unplanned }\n" +
    "  • leave_history: every leave request across the company, enriched with userName, " +
    "image, department, leaveTypeName, leaveCategory.\n" +
    "\n\nUNDERSTANDING THE FLOW: Backend uses the caller's company context (no inputs " +
    "needed). EmployeeAdmin callers with department_access=0 see only their department's " +
    "leaves. Full Admin callers see everything in the tenant. The caller's own leaves are " +
    "excluded — use get_leave_summary for those. " +
    "\n\nUSE THIS TOOL TO: build an admin leave-management dashboard, see what's pending " +
    "approval across the team, or get a quick count of approved vs rejected for the period. " +
    "For one specific employee's details use get_employee_leave_summary.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leave", "admin", "dashboard"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<CompanyOverviewResponse>(
      `${SERVICE.ATTENDANCE}/get-company-leaveOverview`,
      {},
      ctx,
      { injectCompanyContext: false },
    );

    console.log("res: ", res);

    return {
      stats: res.data?.stats ?? null,
      leave_history: res.data?.leaveHistory ?? null,
    };
  },
};

toolRegistry.register(getCompanyLeaveOverviewTool);
