/**
 * Answers: "Who's on the team? Show me the employee list."
 *
 * Calls /getActiveEmployeesListData to get active employees with
 * their departments and designations.
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
});

interface EmployeeSummary {
  user_id: number;
  name: string;
  email: string;
  department: string;
  designation: string;
  role: string;
  status: string;
}

interface ListEmployeesResult {
  total: number;
  employees: EmployeeSummary[];
}

interface EmployeeRecord {
  key?: number;
  Name?: string;
  Email?: string;
  Department?: string;
  Designation?: string;
  Status?: string;
  role_char?: string;
}

interface EmployeesResponse {
  data: {
    data: {
      totalUsers?: number;
      allUsers: EmployeeRecord[];
    };
  };
}

export const listEmployeesTool: ToolDefinition<
  typeof schema,
  ListEmployeesResult
> = {
  name: "list_employees",
  title: "List Employees",
  description:
    "Lists employees in the company with their name, email, department, and designation. " +
    "Use this to: resolve user IDs to names, find out who's on a team, look up an employee by name. " +
    "Pair this with get_user_performance_ranking to show names alongside performance data.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["users", "team", "lookup"] },

  handler: async (input, ctx) => {
    const res = await usersPost<EmployeesResponse>(
      "/getEmployeesListData",
      {},
      ctx,
      {
        injectCompanyContext: false,
      },
    );

    const data = res.data.data ?? {};

    let users = data?.allUsers ?? [];

    if (input.department) {
      const deptLower = input.department.toLowerCase();
      users = users.filter((u) =>
        (u.Department ?? "").toLowerCase().includes(deptLower),
      );
    }

    if (input.search) {
      const searchLower = input.search.toLowerCase();
      users = users.filter(
        (u) =>
          (u.Name ?? "").toLowerCase().includes(searchLower) ||
          (u.Email ?? "").toLowerCase().includes(searchLower),
      );
    }

    const employees: EmployeeSummary[] = users.map((u) => ({
      user_id: u.key ?? 0,
      name: u.Name ?? "Unknown",
      email: u.Email ?? "",
      department: u.Department ?? "Unassigned",
      designation: u.Designation ?? "Unassigned",
      role: u.role_char ?? "EMPLOYEE",
      status: u.Status ?? "Active",
    }));

    return {
      total: employees.length,
      employees,
    };
  },
};

toolRegistry.register(listEmployeesTool);
