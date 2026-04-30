import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface AssetCategoryRef {
  id: number | null;
  name: string;
  status: string;
  level: number;
  is_deleted: boolean;
  breadcrumb: string;
  path: Array<{ id: number; name: string; level: number; is_deleted: boolean }>;
}

interface AssetProductSummary {
  id: number;
  name: string;
  brand: string | null;
  model: string | null;
  serial_no: string | null;
  warranty: string | null;
  purchase_date: string | null;
  purchase_from: string | null;
  status: string;
  asset_category_id: number | null;
  category: AssetCategoryRef;
  image_url: string | null;
  created_at: string | null;
}

interface ProductRecord {
  id?: number;
  name?: string;
  brand?: string | null;
  model?: string | null;
  serial_no?: string | null;
  warranty?: string | null;
  purchase_date?: string | null;
  purchase_from?: string | null;
  status?: string;
  asset_category_id?: number | null;
  category?: AssetCategoryRef;
  image_url_object?: string | null;
  created_at?: string | null;
}

interface ProductsResponse {
  data: {
    data: ProductRecord[];
  };
}

interface ListAssetProductsResult {
  total: number;
  products: AssetProductSummary[];
}

const mapProduct = (p: ProductRecord): AssetProductSummary => ({
  id: p.id ?? 0,
  name: p.name ?? "Unknown",
  brand: p.brand ?? null,
  model: p.model ?? null,
  serial_no: p.serial_no ?? null,
  warranty: p.warranty ?? null,
  purchase_date: p.purchase_date ?? null,
  purchase_from: p.purchase_from ?? null,
  status: p.status ?? "Active",
  asset_category_id: p.asset_category_id ?? null,
  category: p.category ?? {
    id: null,
    name: "Unknown Category",
    status: "Unknown",
    level: 0,
    is_deleted: false,
    breadcrumb: "",
    path: [],
  },
  image_url: p.image_url_object ?? null,
  created_at: p.created_at ?? null,
});

export const listAssetProductsTool: ToolDefinition<
  typeof schema,
  ListAssetProductsResult
> = {
  name: "list_asset_products",
  title: "List asset products — every catalogued asset (laptops, phones, monitors) in inventory",
  description:
    "Returns every asset product registered in the company catalogue with brand, model, serial " +
    "number, warranty, purchase date/source, status, and the full category breadcrumb (e.g. " +
    "'Electronics > Laptops > MacBooks'). Each product also carries the underlying " +
    "asset_category_id for cross-tool joining. " +
    "\n\nUSE THIS TOOL TO: list the asset catalogue, look up a product by name/serial, or pair " +
    "with list_asset_categories to understand the inventory hierarchy. " +
    "\n\nNOTE: Returns ALL products (assigned + unassigned). For only-not-yet-allocated stock use " +
    "list_unassigned_asset_products. For who-has-what (assigned-asset records) use " +
    "list_assigned_assets in the assets-service tools.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["assets", "products", "inventory", "catalogue"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<ProductsResponse>(
      `${SERVICE.USERS}/getProducts`,
      {},
      ctx,
    );

    const records = res?.data?.data ?? [];
    return { total: records.length, products: records.map(mapProduct) };
  },
};

toolRegistry.register(listAssetProductsTool);
