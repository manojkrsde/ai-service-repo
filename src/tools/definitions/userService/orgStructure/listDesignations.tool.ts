import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface DesignationSummary {
  id: number;
  name: string;
  department: string | null;
  department_id: number | null;
  employee_count: number;
  status: string;
}

interface DesignationRecord {
  key?: number;
  Designation?: string;
  Department?: string | null;
  Department_id?: number | null;
  NoOfEmployees?: number;
  Status?: string;
}

interface DesignationsResponse {
  data: {
    data: DesignationRecord[];
  };
}

interface ListDesignationsResult {
  total: number;
  designations: DesignationSummary[];
}

export const listDesignationsTool: ToolDefinition<
  typeof schema,
  ListDesignationsResult
> = {
  name: "list_designations",
  title:
    "List job designations / titles — every role with its parent department, headcount & status",
  description:
    "Returns every designation (job title / role) defined for the company. Per entry: id, name " +
    "(e.g. 'Senior Engineer', 'HR Manager'), parent department name and id, current employee " +
    "headcount holding that role, and Active / Inactive status. Sorted alphabetically by name." +
    "\n\nUSE THIS TOOL TO:" +
    "\n• List all roles / titles in the org for a 'what designations do we have' answer" +
    "\n• Resolve a designation NAME → id before applying it as a filter elsewhere" +
    "\n• See how many people hold each role at a glance ('we have 12 Senior Engineers and 3 " +
    "Engineering Managers')" +
    "\n• Validate that a specific designation exists before referencing it" +
    "\n• Build a role × department matrix when paired with list_departments" +
    "\n\nNOTE:" +
    "\n• For the SAME data PLUS the actual employees holding each role, use " +
    "list_designations_with_user_count — it nests a users[] array per designation. Heavier, but " +
    "answers 'who holds X role' in a single call." +
    "\n• For ONE employee's designation use get_employee_by_id." +
    "\n• For department-level grouping use list_departments instead." +
    "\n• Soft-deleted designations are excluded automatically (backend filters status != 2)." +
    "\n• The headcount counts EVERY assignment, including inactive employees. For active-only " +
    "counts cross-reference with list_employees(status='active').",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["designations", "roles", "organization", "lookup"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<DesignationsResponse>(
      `${SERVICE.USERS}/getDesignation`,
      {},
      ctx,
      { injectCompanyContext: false },
    );

    const records = res?.data?.data ?? [];
    const designations: DesignationSummary[] = records.map((d) => ({
      id: d.key ?? 0,
      name: d.Designation ?? "Unknown",
      department: d.Department ?? null,
      department_id: d.Department_id ?? null,
      employee_count: d.NoOfEmployees ?? 0,
      status: d.Status ?? "Active",
    }));

    return { total: designations.length, designations };
  },
};

toolRegistry.register(listDesignationsTool);
