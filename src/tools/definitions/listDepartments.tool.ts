/**
 * Answers: "What departments do we have? How many people are in Sales?"
 *
 * Calls /getDepartment to list departments with employee counts.
 */
import { z } from "zod";

import { usersPost } from "../../helpers/users.client.js";
import type { ToolDefinition } from "../../types/tool.types.js";
import { toolRegistry } from "../registry.js";

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
  data?: DepartmentRecord[];
}

export const listDepartmentsTool: ToolDefinition<
  typeof schema,
  ListDepartmentsResult
> = {
  name: "list_departments",
  title: "List Departments",
  description:
    "Lists all departments in the company with their employee counts. " +
    "Use this to answer: What departments do we have? How many people are in Sales? " +
    "What's our organizational structure?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["users", "organization", "lookup"] },

  handler: async (_input, ctx) => {
    const res = await usersPost<DepartmentsResponse>(
      "/getDepartment",
      {},
      ctx,
    );

    const departments: DepartmentSummary[] = (res.data ?? []).map((d) => ({
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
