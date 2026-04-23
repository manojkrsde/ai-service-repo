/**
 * Answers: "What departments do we have? How many people are in Sales?"
 *
 * Calls /getDepartment to list departments with employee counts.
 */
import { z } from "zod";

import { usersPost } from "../../../helpers/users.client.js";
import type { ToolDefinition } from "../../../types/tool.types.js";
import { toolRegistry } from "../../registry.js";

const schema = z.object({});

interface DepartmentSummary {
  id: number;
  name: string;
  employee_count: number;
  status: string;
}

interface ListDepartmentsResult {
  total: number;
  departments: DepartmentSummary[];
}

interface DepartmentRecord {
  key?: number;
  Department?: string;
  NoOfEmployees?: number;
  Status?: string;
}

interface DepartmentsResponse {
  data: {
    data: DepartmentRecord[];
  };
}

export const listDepartmentsTool: ToolDefinition<
  typeof schema,
  ListDepartmentsResult
> = {
  name: "list_departments",
  title: "Browse departments — names, headcount, and status",
  description:
    "Returns the full department directory with each department's ID, name, " +
    "employee headcount, and active/inactive status. " +
    "\n\nUSE THIS TOOL TO: list all departments in the organisation, check how many " +
    "employees are in a specific department, resolve a department name before filtering " +
    "list_employees by department, or map out the company's organisational structure. " +
    "\n\nNOTE: For employee-level detail (names, emails, roles) use list_employees with " +
    "the department filter instead.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["departments", "organization", "lookup"] },

  handler: async (_input, ctx) => {
    const res = await usersPost<DepartmentsResponse>(
      "/getDepartment",
      {},
      ctx,
      {
        injectCompanyContext: false,
      },
    );

    const apiResponse = res.data.data ?? [];

    const departments: DepartmentSummary[] = (apiResponse ?? []).map((d) => ({
      id: d.key ?? 0,
      name: d.Department ?? "Unknown",
      employee_count: d.NoOfEmployees ?? 0,
      status: d.Status ?? "Active",
    }));

    return {
      total: departments.length,
      departments,
    };
  },
};

toolRegistry.register(listDepartmentsTool);
