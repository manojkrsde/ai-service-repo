import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface ActiveEmployeeStats {
  total: number;
  active: number;
  inactive: number;
  new_joiners_last_30_days: number;
}

interface ListActiveEmployeesResult {
  stats: ActiveEmployeeStats;
  returned: number;
  employees: Record<string, unknown>[];
}

interface ListActiveResponse {
  data?: {
    data?: {
      totalUsers?: number;
      activeUsers?: number;
      inactiveUsers?: number;
      newJoiners?: number;
      mappedData?: Record<string, unknown>[];
      allUsers?: Record<string, unknown>[];
    };
  };
}

export const listActiveEmployeesTool: ToolDefinition<
  typeof schema,
  ListActiveEmployeesResult
> = {
  name: "list_active_employees",
  title: "Active employees only — lighter alternative to list_employees",
  description:
    "Returns ACTIVE employees (status=1) for the caller's company plus headcount stats. " +
    "Each row carries the same enriched profile fields as `list_employees`. The response also " +
    "includes `stats`: total, active, inactive, and new_joiners_last_30_days." +
    "\n\nUNDERSTANDING THE FLOW: Backend filters `m_users` by `status = 1` and the caller's " +
    "company scope (Primary uses `primary_company_id`, Secondary uses `secondary_company_id`). " +
    "Admin-role users are excluded from the returned list and stats. company_id / company_type " +
    "are auto-injected via session auth." +
    "\n\nUSE THIS TOOL TO: build a contact list of currently-employed staff, count active " +
    "headcount, surface new joiners, or feed an LLM a clean roster (no ex-employees mixed in)." +
    "\n\nNOTE: For a richer, filterable directory (status filter, department/search filters) " +
    "use `list_employees`. For one user's full profile use `get_employee_by_id`.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["users", "team", "list"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<ListActiveResponse>(
      `${SERVICE.USERS}/getActiveEmployeesListData`,
      {},
      ctx,
      { injectCompanyContext: false },
    );

    const payload = res?.data?.data ?? {};
    const employees =
      payload.mappedData ?? payload.allUsers ?? [];

    return {
      stats: {
        total: payload.totalUsers ?? employees.length,
        active: payload.activeUsers ?? employees.length,
        inactive: payload.inactiveUsers ?? 0,
        new_joiners_last_30_days: payload.newJoiners ?? 0,
      },
      returned: employees.length,
      employees,
    };
  },
};

toolRegistry.register(listActiveEmployeesTool);
