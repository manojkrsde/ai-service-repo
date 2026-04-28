/**
 * Lists call-center leads assigned to a set of employees over a date
 * range — admin-oriented audit view.
 *
 * Wraps POST /get-leads-by-employee-date. Backend Joi (camelCase):
 *   signature, employeeIds (REQUIRED array of numbers, min 1),
 *   companyId (required), companyType (required), dateMandatory? (default false),
 *   startDate? (allow empty/null), endDate? (allow empty/null),
 *   additionalFilters? (object).
 * Company-context injection is suppressed because the schema is camelCase.
 *
 * Scoping: the middleware allows admin / employeeadmin to query for any
 * employee. Non-admin callers may only pass their OWN id in employeeIds —
 * any other set yields HTTP 401 'Access Denied - You can only access your
 * own data'.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  employee_ids: z
    .array(z.number().int().positive())
    .min(1)
    .describe(
      "User IDs of the employees whose assigned leads to fetch. Non-admin callers may " +
        "ONLY pass their own user_id — passing any other id triggers HTTP 401.",
    ),
  start_date: z
    .string()
    .optional()
    .describe(
      "Restrict to leads created in this window (YYYY-MM-DD, inclusive). Filters on the " +
        "lead's createdAt, NOT on call_log timestamps.",
    ),
  end_date: z
    .string()
    .optional()
    .describe("End of the createdAt window (YYYY-MM-DD, inclusive)."),
});

interface CallLogEntry {
  date?: string;
  type?: string;
  note?: string;
  reminder_date?: string;
}

interface AssignedLead {
  id: number;
  name: string;
  email: string | null;
  mobile_number: string;
  status: string;
  country: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  user_ids: number[];
  call_logs: CallLogEntry[];
  created_at: string;
  updated_at: string;
}

interface ListLeadsByEmployeeResult {
  employee_ids: number[];
  start_date: string | null;
  end_date: string | null;
  returned: number;
  leads: AssignedLead[];
}

interface AssignedLeadRecord {
  id?: number;
  name?: string;
  email?: string | null;
  mobileNumber?: string;
  status?: string;
  country?: string | null;
  state?: string | null;
  district?: string | null;
  city?: string | null;
  userIds?: number[];
  call_logs?: CallLogEntry[];
  createdAt?: string;
  updatedAt?: string;
}

interface ListLeadsByEmployeeResponse {
  msg?: string;
  data?: AssignedLeadRecord[];
}

export const listLeadsByEmployeeTool: ToolDefinition<
  typeof schema,
  ListLeadsByEmployeeResult
> = {
  name: "list_leads_by_employee",
  title:
    "List leads by employee — every lead assigned to one or more agents",
  description:
    "Returns all call-center leads where userIds contains any of the given employee_ids — " +
    "i.e. every lead assigned to the named agents — optionally restricted by the lead's " +
    "createdAt date range. Each row includes id, name, mobile_number, status, location, " +
    "the assignee user_ids array, the full call_logs history, and timestamps. Ordered by " +
    "updatedAt DESC. " +
    "\n\nUNDERSTANDING THE FLOW: This is an admin/audit view. Use it to answer 'what's on " +
    "Rahul's plate?', 'which leads are Priya and Asha working between?'. employeeadmin " +
    "and admin callers can pass any employee_ids; non-admin callers must pass exactly " +
    "[their_own_user_id] or the request fails with HTTP 401. start_date / end_date filter " +
    "on the LEAD's createdAt, NOT on call_log dates — for the latter use list_worked_call_leads. " +
    "\n\nUSE THIS TOOL TO: build a per-agent workload view, audit which leads were handed " +
    "to whom in a given week, or pull a single agent's full assignment history. For an " +
    "agent's call activity (rather than lead assignments) use get_user_call_stats. " +
    "\n\nNOTE: Includes both leads with and without call_logs — to filter to only worked " +
    "leads, follow up with list_worked_call_leads scoped by user_ids.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calls", "leads"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      employeeIds: input.employee_ids,
      companyId: ctx.companyId,
      companyType: ctx.companyType,
    };
    if (input.start_date) body["startDate"] = input.start_date;
    if (input.end_date) body["endDate"] = input.end_date;

    const res = await apiPost<ListLeadsByEmployeeResponse>(
      `${SERVICE.CALL_LOGS}/get-leads-by-employee-date`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    const records = res.data ?? [];
    const leads: AssignedLead[] = records.map((r) => ({
      id: r.id ?? 0,
      name: r.name ?? "",
      email: r.email ?? null,
      mobile_number: r.mobileNumber ?? "",
      status: r.status ?? "",
      country: r.country ?? null,
      state: r.state ?? null,
      district: r.district ?? null,
      city: r.city ?? null,
      user_ids: r.userIds ?? [],
      call_logs: r.call_logs ?? [],
      created_at: r.createdAt ?? "",
      updated_at: r.updatedAt ?? "",
    }));

    return {
      employee_ids: input.employee_ids,
      start_date: input.start_date ?? null,
      end_date: input.end_date ?? null,
      returned: leads.length,
      leads,
    };
  },
};

toolRegistry.register(listLeadsByEmployeeTool);
