/**
 * Answers: "Who's on the team? Show me the employee list."
 *
 * Calls /getActiveEmployeesListData to get active employees with
 * their departments, designations, contact info, joining dates, and more.
 *
 * Backend response (via common.message.data_found) shape:
 * {
 *   data: {
 *     totalUsers, activeUsers, inactiveUsers, newJoiners,
 *     allUsers: [{
 *       key, id, Name, Email, Department, Designation, EmpId,
 *       Phone, JoiningDate, dol, Status, role_char, gender,
 *       ReportingOfficer: { key, name, Designation, Department },
 *       CompanyId, CompanyType, CompanyName, DesignationId,
 *       is_work_from, is_biometric_enable
 *     }]
 *   }
 * }
 */
import { z } from "zod";

import { usersPost } from "../../helpers/users.client.js";
import type { ToolDefinition } from "../../types/tool.types.js";
import { toolRegistry } from "../registry.js";

const schema = z.object({
  department: z
    .string()
    .optional()
    .describe(
      "Filter by department name (case-insensitive partial match, optional)",
    ),
  search: z
    .string()
    .optional()
    .describe("Search by employee name or email (optional)"),
  status: z
    .enum(["active", "inactive", "all"])
    .default("all")
    .describe(
      "Filter by employment status. 'active' = currently employed, 'inactive' = on leave/disabled",
    ),
});

interface ReportingOfficer {
  id: number | null;
  name: string | null;
  designation: string | null;
}

interface EmployeeSummary {
  user_id: number;
  emp_id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  role: string;
  status: string;
  joining_date: string;
  date_of_leaving: string | null;
  reporting_officer: ReportingOfficer;
  company_name: string;
}

interface EmployeeStats {
  total: number;
  active: number;
  inactive: number;
  new_joiners_last_30_days: number;
}

interface ListEmployeesResult {
  stats: EmployeeStats;
  returned: number;
  employees: EmployeeSummary[];
}

interface RawReportingOfficer {
  key?: number;
  name?: string;
  Designation?: string;
}

interface EmployeeRecord {
  key?: number;
  id?: number;
  Name?: string;
  Email?: string;
  Department?: string;
  Designation?: string;
  Status?: string;
  role_char?: string;
  EmpId?: string;
  Phone?: string;
  JoiningDate?: string;
  dol?: string;
  ReportingOfficer?: RawReportingOfficer;
  CompanyName?: string;
}

interface EmployeesData {
  totalUsers?: number;
  activeUsers?: number;
  inactiveUsers?: number;
  newJoiners?: number;
  allUsers?: EmployeeRecord[];
}

interface EmployeesResponse {
  data?: EmployeesData;
}

export const listEmployeesTool: ToolDefinition<
  typeof schema,
  ListEmployeesResult
> = {
  name: "list_employees",
  title: "List Employees",
  description:
    "Lists employees with full profile data: name, email, phone, department, designation, " +
    "role, employment status, joining date, reporting officer, and company. " +
    "Use this to: resolve user IDs to names, find who's on a team, look up an employee by " +
    "name or email, check someone's department or manager, see new joiners. " +
    "Pair with get_user_performance_ranking to show names alongside stats. " +
    "Returns company-level stats (total, active, inactive, new joiners) as well.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "2.0.0", tags: ["users", "team", "lookup"] },

  handler: async (input, ctx) => {
    const res = await usersPost<EmployeesResponse>(
      "/getEmployeesListData",
      {},
      ctx,
      { injectCompanyContext: false },
    );

    const responseData = res.data ?? {};
    let users = responseData.allUsers ?? [];

    // Apply status filter
    if (input.status === "active") {
      users = users.filter((u) => u.Status === "Active");
    } else if (input.status === "inactive") {
      users = users.filter((u) => u.Status !== "Active");
    }

    // Apply department filter
    if (input.department) {
      const deptLower = input.department.toLowerCase();
      users = users.filter((u) =>
        (u.Department ?? "").toLowerCase().includes(deptLower),
      );
    }

    // Apply name/email search
    if (input.search) {
      const searchLower = input.search.toLowerCase();
      users = users.filter(
        (u) =>
          (u.Name ?? "").toLowerCase().includes(searchLower) ||
          (u.Email ?? "").toLowerCase().includes(searchLower),
      );
    }

    const employees: EmployeeSummary[] = users.map((u) => ({
      user_id: u.key ?? u.id ?? 0,
      emp_id: u.EmpId ?? "",
      name: u.Name ?? "Unknown",
      email: u.Email ?? "",
      phone: u.Phone ?? "",
      department: u.Department ?? "Unassigned",
      designation: u.Designation ?? "Unassigned",
      role: u.role_char ?? "EMPLOYEE",
      status: u.Status ?? "Active",
      joining_date: u.JoiningDate ?? "",
      date_of_leaving: u.dol || null,
      reporting_officer: {
        id: u.ReportingOfficer?.key ?? null,
        name: u.ReportingOfficer?.name ?? null,
        designation: u.ReportingOfficer?.Designation ?? null,
      },
      company_name: u.CompanyName ?? "",
    }));

    return {
      stats: {
        total: responseData.totalUsers ?? employees.length,
        active:
          responseData.activeUsers ??
          employees.filter((e) => e.status === "Active").length,
        inactive:
          responseData.inactiveUsers ??
          employees.filter((e) => e.status !== "Active").length,
        new_joiners_last_30_days: responseData.newJoiners ?? 0,
      },
      returned: employees.length,
      employees,
    };
  },
};

toolRegistry.register(listEmployeesTool);
