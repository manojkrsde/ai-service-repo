import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface PotentialManager {
  user_id: number;
  name: string;
  designation: string | null;
  department: string | null;
}

interface PotentialManagerRecord {
  key?: number;
  name?: string;
  Designation?: string | null;
  Department?: string | null;
}

interface ReportingOfficerResponse {
  data: {
    data: PotentialManagerRecord[];
  };
}

interface GetReportingOfficerResult {
  total: number;
  managers: PotentialManager[];
}

export const getReportingOfficerTool: ToolDefinition<
  typeof schema,
  GetReportingOfficerResult
> = {
  name: "list_reporting_officers",
  title:
    "List potential reporting officers (managers) — every non-admin employee with their designation & department",
  description:
    "Returns every employee in the current company who is eligible to act as a reporting officer " +
    "(i.e. every active non-admin user — the candidate pool used by manager-picker UIs). Each " +
    "entry includes user_id, full name, designation / role, and department. Sorted alphabetically " +
    "by first name then last name (backend-side)." +
    "\n\nUSE THIS TOOL TO:" +
    "\n• Discover who could be set as someone's manager when assigning a new employee, populating " +
    "a manager-picker, or routing an approval workflow" +
    "\n• Resolve 'managers in <Department>' by post-filtering this list on department" +
    "\n• Cross-reference candidate managers against list_employees to spot orphaned reports " +
    "(employees whose reporting_officer_id no longer exists in this list)" +
    "\n• Build org-chart slices grouped by department + designation" +
    "\n\nNOTE:" +
    "\n• Excludes Admin role users (backend filter on role_char != 'Admin'). If you need Admins " +
    "too, use list_employees with status='all'." +
    "\n• This is a CANDIDATE pool, not the actual currently-assigned managers. It does NOT confirm " +
    "'person X currently reports to person Y' — only list_employees and get_employee_by_id expose " +
    "the assigned reporting_officer relationship." +
    "\n• Returns every active non-admin employee, so the list can be large for big orgs." +
    "\n• For a single employee's CURRENTLY ASSIGNED reporting officer prefer get_employee_by_id — " +
    "it returns the assigned manager directly along with the full profile." +
    "\n• Strictly company-scoped via session auth; never crosses tenants.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["users", "managers", "lookup"] },

  handler: async (_input, ctx) => {
    const auth = ctx.sessionAuth;
    if (!auth) {
      throw new Error(
        "[AUTH_ERROR] Session credentials not available. Please re-initialize the MCP session.",
      );
    }

    const res = await apiPost<ReportingOfficerResponse>(
      `${SERVICE.USERS}/getReportingOfficer`,
      { companyId: auth.companyId, companyType: auth.companyType },
      ctx,
      { injectCompanyContext: false },
    );

    const records = res?.data?.data ?? [];
    const managers: PotentialManager[] = records.map((r) => ({
      user_id: r.key ?? 0,
      name: (r.name ?? "Unknown").trim(),
      designation: r.Designation ?? null,
      department: r.Department ?? null,
    }));

    return { total: managers.length, managers };
  },
};

toolRegistry.register(getReportingOfficerTool);
