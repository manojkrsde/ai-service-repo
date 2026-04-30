/**
 * Answers: "Who's on the team? Show me the employee list."
 *
 * Calls /getEmployeesListData to get active all employees with
 * their departments, designations, contact info, joining dates, and more.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

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
      "Filter by employment status. 'active' = currently employed, 'inactive' = employee left the company",
    ),
});

interface ReportingOfficer {
  id: number | null;
  name: string | null;
  designation: string | null;
  department?: string | null;
}

interface EmployeeSummary {
  user_id: number;
  emp_id: string;
  name: string;
  email: string;
  mobile: string;
  department: string;
  designation: string;
  role: string;
  status: string;
  joining_date: string;
  date_of_leaving: string | null;
  reporting_officer: ReportingOfficer;
  company_name: string;
  profile_pic_url: string | null;
  gender: string | null;
  date_of_birth: string | null;
  official_phone_number: string | null;
  biometric_essl_id: string | null;
  is_work_from: boolean | null;
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

interface EmployeeRecord {
  key?: number;
  id?: number;
  Name?: string;
  Email?: string;
  Mobile?: string;
  Department?: string;
  Designation?: string;
  Status?: string;
  role_char?: string;
  EmpId?: string;
  Phone?: string;
  JoiningDate?: string;
  dol?: string;
  ReportingOfficerId: number | null;
  ReportingOfficer?: string | null;
  CompanyName?: string;
  Image: string | null;
  Gender: string | null;
  DOB: string | null;
  Official_Phone_code: string | null;
  Official_Phone_Number: string | null;
  essl_id: string | null;
  is_work_from: boolean | null;
}

interface EmployeesData {
  totalUsers?: number;
  activeUsers?: number;
  inactiveUsers?: number;
  newJoiners?: number;
  allUsers?: EmployeeRecord[];
}

interface EmployeesResponse {
  data: {
    data: EmployeesData;
  };
}

export const listEmployeesTool: ToolDefinition<
  typeof schema,
  ListEmployeesResult
> = {
  name: "list_employees",
  title: "Look up employees — contact info, department, manager, status & more",
  description:
    "Primary employee directory — the single source of truth for all staff data. " +
    "Returns full profiles including: name, email, mobile, official phone, gender, DOB, " +
    "department, designation, role, employment status (active/inactive), joining date, " +
    "date of leaving, reporting officer (name + designation + department), company, " +
    "profile picture, biometric ESSL ID, and work-from-home flag. " +
    "Also returns org-level stats: total headcount, active, inactive, and new joiners in the last 30 days. " +
    "\n\nUSE THIS TOOL TO: look up any employee by name or email, resolve a user ID to a full profile, " +
    "find who manages someone, list a department's team, check joining or leaving dates, " +
    "get a phone number or contact detail, or verify employment status. " +
    "Supports optional filters: status (active | inactive | all), department (partial match), " +
    "and name/email search. " +
    "\n\nNOTE: This is the only tool that returns employee contact numbers and personal details — " +
    "always call this before concluding that employee data is unavailable.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "2.0.0", tags: ["users", "team", "lookup"] },

  handler: async (input, ctx) => {
    const res = await apiPost<EmployeesResponse>(
      `${SERVICE.USERS}/getEmployeesListData`,
      {},
      ctx,
      { injectCompanyContext: false },
    );

    const responseData = res?.data?.data ?? {};
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

    const employees: EmployeeSummary[] = users.map((u) => {
      const reportingOfficer = u.ReportingOfficer?.split("-");
      return {
        user_id: u.key ?? u.id ?? 0,
        emp_id: u.EmpId ?? "",
        name: u.Name ?? "Unknown",
        email: u.Email ?? "",
        mobile: u.Phone ?? "",
        department: u.Department ?? "Unassigned",
        designation: u.Designation ?? "Unassigned",
        role: u.role_char ?? "EMPLOYEE",
        status: u.Status ?? "Active",
        joining_date: u.JoiningDate ?? "",
        date_of_leaving: u.dol || null,
        reporting_officer: {
          id: u.ReportingOfficerId,
          name: reportingOfficer?.[0] ?? null,
          designation: reportingOfficer?.[1] ?? null,
          department: reportingOfficer?.[2] ?? null,
        },
        company_name: u.CompanyName ?? "",
        profile_pic_url: u.Image,
        gender: u.Gender,
        date_of_birth: u.DOB,
        official_phone_number: `${u.Official_Phone_code}-${u.Official_Phone_Number}`,
        biometric_essl_id: u.essl_id ?? "",
        is_work_from: u.is_work_from ?? false,
      };
    });

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
