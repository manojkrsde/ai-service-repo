import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  assigned_to_type: z
    .enum(["user", "location", "department"])
    .optional()
    .describe(
      "Optional client-side filter on assignment target type. Omit for all assignment types.",
    ),
});

interface AssignedAssetSummary {
  id: number;
  product_id: number | null;
  product_name: string | null;
  product_model: string | null;
  serial_no: string | null;
  company_id: number | null;
  company_name: string | null;
  company_type: string | null;
  assigned_to: number | null;
  assigned_to_type: string | null;
  assigned_to_name: string;
  assigned_to_designation: string | null;
  assigned_by: number | null;
  assigned_by_name: string;
  assigned_by_designation: string | null;
  assigned_date: string | null;
  unassigned_date: string | null;
  asset_category_id: number | null;
  status: string;
}

interface AssetRecord {
  id?: number;
  product_id?: number | null;
  product_name?: string | null;
  product_model?: string | null;
  serial_no?: string | null;
  company_id?: number | null;
  company_name?: string | null;
  company_type?: string | null;
  assigned_to?: number | null;
  assigned_to_type?: string | null;
  assigned_to_name?: string;
  assigned_to_designation?: string | null;
  assigned_by?: number | null;
  assigned_by_name?: string;
  assigned_by_designation?: string | null;
  assigned_date?: string | null;
  unassigned_date?: string | null;
  asset_category_id?: number | null;
  status?: string;
}

interface AssetsResponse {
  data: {
    data: AssetRecord[];
  };
}

interface ListAssignedAssetsResult {
  total: number;
  returned: number;
  assets: AssignedAssetSummary[];
}

export const listAssignedAssetsTool: ToolDefinition<
  typeof schema,
  ListAssignedAssetsResult
> = {
  name: "list_assigned_assets",
  title:
    "List all assigned assets — company-wide inventory with assignee, product & status",
  description:
    "Returns every asset that has been assigned across the company, enriched with assignment " +
    "target (user / location / department), product details (name, model, serial), assignee " +
    "designation, who assigned it, dates, and active/inactive status. " +
    "\n\nUSE THIS TOOL TO: see the full assigned-asset inventory, audit who has what, count " +
    "assets by assignment type, or pre-filter before drilling into a specific asset with " +
    "get_assigned_asset_details / get_asset_with_history. " +
    "\n\nNOTE: Soft-deleted assets (status=2) are excluded server-side. For an employee's own " +
    "assigned assets use get_employee_assigned_assets — it's faster than filtering this list. " +
    "For inventory analytics (counts, monthly trend) use get_assets_dashboard.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["assets", "inventory", "lookup"] },

  handler: async (input, ctx) => {
    const res = await apiPost<AssetsResponse>(
      `${SERVICE.ASSETS}/getListAssignedAssets`,
      {},
      ctx,
    );

    let records = res?.data?.data ?? [];
    const total = records.length;

    if (input.assigned_to_type) {
      records = records.filter((a) => a.assigned_to_type === input.assigned_to_type);
    }

    const assets: AssignedAssetSummary[] = records.map((a) => ({
      id: a.id ?? 0,
      product_id: a.product_id ?? null,
      product_name: a.product_name ?? null,
      product_model: a.product_model ?? null,
      serial_no: a.serial_no ?? null,
      company_id: a.company_id ?? null,
      company_name: a.company_name ?? null,
      company_type: a.company_type ?? null,
      assigned_to: a.assigned_to ?? null,
      assigned_to_type: a.assigned_to_type ?? null,
      assigned_to_name: a.assigned_to_name ?? "Unassigned",
      assigned_to_designation: a.assigned_to_designation ?? null,
      assigned_by: a.assigned_by ?? null,
      assigned_by_name: a.assigned_by_name ?? "N/A",
      assigned_by_designation: a.assigned_by_designation ?? null,
      assigned_date: a.assigned_date ?? null,
      unassigned_date: a.unassigned_date ?? null,
      asset_category_id: a.asset_category_id ?? null,
      status: a.status ?? "Active",
    }));

    return { total, returned: assets.length, assets };
  },
};

toolRegistry.register(listAssignedAssetsTool);
