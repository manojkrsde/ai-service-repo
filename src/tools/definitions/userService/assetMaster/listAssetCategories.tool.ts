import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface AssetCategoryNode {
  id: number;
  name: string;
  status: string;
  parent_id: number | null;
  category_level: number;
  created_at: string | null;
  updated_at: string | null;
  subcategories: AssetCategoryNode[];
}

interface CategoryRecord {
  id?: number;
  name?: string;
  status?: string;
  parentId?: number | null;
  category_level?: number;
  created_at?: string | null;
  updated_at?: string | null;
  subcategories?: CategoryRecord[];
}

interface CategoriesResponse {
  data: {
    data: CategoryRecord[];
  };
}

interface ListAssetCategoriesResult {
  total_root_categories: number;
  categories: AssetCategoryNode[];
}

const mapCategory = (c: CategoryRecord): AssetCategoryNode => ({
  id: c.id ?? 0,
  name: c.name ?? "Unknown",
  status: c.status ?? "Active",
  parent_id: c.parentId ?? null,
  category_level: c.category_level ?? 0,
  created_at: c.created_at ?? null,
  updated_at: c.updated_at ?? null,
  subcategories: (c.subcategories ?? []).map(mapCategory),
});

export const listAssetCategoriesTool: ToolDefinition<
  typeof schema,
  ListAssetCategoriesResult
> = {
  name: "list_asset_categories",
  title: "List asset categories — hierarchical asset-type taxonomy (laptops, phones, …)",
  description:
    "Returns the asset category tree for the company: each node has id, name, status, " +
    "category_level (0 = root, 1+ = nested), and a recursive `subcategories` array. Used to " +
    "classify physical/virtual assets (e.g. Electronics > Laptops > MacBooks). " +
    "\n\nUSE THIS TOOL TO: discover asset taxonomy, resolve a category name to an ID before " +
    "filtering the asset inventory, or audit how categories are organised. " +
    "\n\nNOTE: Soft-deleted categories are excluded. For products in a category use " +
    "list_asset_products and filter by asset_category_id. For actual assigned assets use the " +
    "assets-service tools (list_assigned_assets, get_assets_dashboard).",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["assets", "categories", "taxonomy", "lookup"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<CategoriesResponse>(
      `${SERVICE.USERS}/getCategory`,
      {},
      ctx,
    );

    const records = res?.data?.data ?? [];
    const categories = records.map(mapCategory);

    return {
      total_root_categories: categories.length,
      categories,
    };
  },
};

toolRegistry.register(listAssetCategoriesTool);
