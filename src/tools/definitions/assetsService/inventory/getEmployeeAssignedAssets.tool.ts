import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  user_id: z
    .number()
    .int()
    .positive()
    .describe(
      "user_id of the employee to fetch assigned assets for. Use list_employees to discover IDs.",
    ),
});

interface EmployeeAssetItem {
  id: number;
  product_name: string;
  image_url: string;
  company: string;
  assigned_to_name: string;
  assigned_by: number | null;
  assigned_by_name: string;
  assigned_date: string | null;
  status: string;
  serial_no: string | null;
}

interface EmployeeAssetRecord {
  id?: number;
  product_id?: string;
  image?: string;
  company_id?: string;
  assigned_to?: string;
  assigned_date?: string | null;
  assigned_by?: number | null;
  assigned_by_raw?: string;
  status?: string;
  serial_no?: string | null;
}

interface EmployeeAssetsResponse {
  data: {
    data: EmployeeAssetRecord[];
  };
}

interface GetEmployeeAssetsResult {
  user_id: number;
  total: number;
  assets: EmployeeAssetItem[];
}

export const getEmployeeAssignedAssetsTool: ToolDefinition<
  typeof schema,
  GetEmployeeAssetsResult
> = {
  name: "get_employee_assigned_assets",
  title: "Get all assets assigned to an employee — laptops, phones, devices & more",
  description:
    "Returns every asset currently assigned to the given employee: product name, serial number, " +
    "the company that assigned it, the person who performed the assignment, dates, and " +
    "active/inactive status. " +
    "\n\nUSE THIS TOOL TO: answer 'what does <employee> have?', generate an exit-checklist of " +
    "assets to recover, or audit per-employee allocation. Resolve the user_id with list_employees " +
    "first if needed. " +
    "\n\nNOTE: Returns assets across all assignment statuses (active and inactive). For company-wide " +
    "inventory (not user-specific) use list_assigned_assets. For an audit history of changes " +
    "to a single asset use get_asset_with_history.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["assets", "users", "lookup", "inventory"] },

  handler: async (input, ctx) => {
    const res = await apiPost<EmployeeAssetsResponse>(
      `${SERVICE.ASSETS}/getEmployeeAssignedAssets`,
      { id: input.user_id },
      ctx,
      { injectCompanyContext: false },
    );

    const records = res?.data?.data ?? [];
    const assets: EmployeeAssetItem[] = records.map((r) => ({
      id: r.id ?? 0,
      product_name: r.product_id ?? "N/A",
      image_url: r.image ?? "",
      company: r.company_id ?? "N/A",
      assigned_to_name: r.assigned_to ?? "N/A",
      assigned_by: typeof r.assigned_by === "number" ? r.assigned_by : null,
      assigned_by_name: r.assigned_by_raw ?? "N/A",
      assigned_date: r.assigned_date ?? null,
      status: r.status ?? "Active",
      serial_no: r.serial_no ?? null,
    }));

    return { user_id: input.user_id, total: assets.length, assets };
  },
};

toolRegistry.register(getEmployeeAssignedAssetsTool);
