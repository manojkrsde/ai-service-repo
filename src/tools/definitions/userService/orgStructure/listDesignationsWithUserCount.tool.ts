import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface UserInDesignation {
  user_id: number;
  name: string;
  email: string;
  phone: string;
  profile_pic_url: string | null;
  department_name: string | null;
}

interface DesignationWithUsers {
  id: number;
  name: string;
  department: string | null;
  department_id: number | null;
  employee_count: number;
  status: string;
  users: UserInDesignation[];
}

interface UserRecord {
  user_id?: number;
  name?: string;
  email?: string;
  phone?: string;
  profile_pic?: string | null;
  department_name?: string | null;
}

interface DesignationWithUsersRecord {
  key?: number;
  Designation?: string;
  Department?: string | null;
  Department_id?: number | null;
  NoOfEmployees?: number;
  Status?: string;
  users?: UserRecord[];
}

interface DesignationsWithUsersResponse {
  data: {
    data: DesignationWithUsersRecord[];
  };
}

interface ListDesignationsWithUsersResult {
  total_designations: number;
  total_employees: number;
  designations: DesignationWithUsers[];
}

export const listDesignationsWithUserCountTool: ToolDefinition<
  typeof schema,
  ListDesignationsWithUsersResult
> = {
  name: "list_designations_with_user_count",
  title: "List designations with employees per role — staffing breakdown by job title",
  description:
    "Returns every designation in the company together with the actual employees holding that " +
    "title (name, email, phone, profile pic, department), plus a per-designation employee count " +
    "and the overall total headcount across designations. " +
    "\n\nUSE THIS TOOL TO: see role-by-role staffing (who holds which title), spot vacant or " +
    "single-person roles, or build an org chart slice grouped by designation. " +
    "\n\nNOTE: This is the heavier analytics-style version of list_designations. If you only need " +
    "the role list with counts (no per-employee detail), use list_designations — it's lighter.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: {
    version: "1.0.0",
    tags: ["designations", "roles", "analytics", "headcount", "organization"],
  },

  handler: async (_input, ctx) => {
    const res = await apiPost<DesignationsWithUsersResponse>(
      `${SERVICE.USERS}/getDesignationWithUser`,
      {},
      ctx,
      { injectCompanyContext: false },
    );

    const records = res?.data?.data ?? [];
    const designations: DesignationWithUsers[] = records.map((d) => ({
      id: d.key ?? 0,
      name: d.Designation ?? "Unknown",
      department: d.Department ?? null,
      department_id: d.Department_id ?? null,
      employee_count: d.NoOfEmployees ?? 0,
      status: d.Status ?? "Active",
      users: (d.users ?? []).map((u) => ({
        user_id: u.user_id ?? 0,
        name: (u.name ?? "Unknown").trim(),
        email: u.email ?? "",
        phone: u.phone ?? "",
        profile_pic_url: u.profile_pic ?? null,
        department_name: u.department_name ?? null,
      })),
    }));

    const totalEmployees = designations.reduce(
      (sum, d) => sum + d.employee_count,
      0,
    );

    return {
      total_designations: designations.length,
      total_employees: totalEmployees,
      designations,
    };
  },
};

toolRegistry.register(listDesignationsWithUserCountTool);
