import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface UnassignedProductSummary {
  id: number;
  name: string;
  brand: string | null;
  model: string | null;
  serial_no: string | null;
  warranty: string | null;
  purchase_date: string | null;
  status: string;
  asset_category_id: number | null;
  category_breadcrumb: string;
  image_url: string | null;
}

interface UnassignedRecord {
  id?: number;
  name?: string;
  brand?: string | null;
  model?: string | null;
  serial_no?: string | null;
  warranty?: string | null;
  purchase_date?: string | null;
  status?: string;
  asset_category_id?: number | null;
  category?: { breadcrumb?: string };
  image_url_object?: string | null;
}

interface UnassignedResponse {
  data: {
    data: UnassignedRecord[];
  };
}

interface ListUnassignedResult {
  total: number;
  unassigned_products: UnassignedProductSummary[];
}

export const listUnassignedAssetProductsTool: ToolDefinition<
  typeof schema,
  ListUnassignedResult
> = {
  name: "list_unassigned_asset_products",
  title: "List unallocated asset stock — products ready to assign to a user/location/department",
  description:
    "Returns asset products that are NOT currently assigned to any user, location, or " +
    "department — i.e. the available stock pool. Each entry includes brand, model, serial number, " +
    "warranty, purchase date, category breadcrumb, and image. " +
    "\n\nUSE THIS TOOL TO: see what's available before assigning an asset, build a 'spare " +
    "inventory' report, or quickly count idle stock by category. " +
    "\n\nNOTE: 'Unassigned' is computed by cross-referencing the assets-service for assigned " +
    "products and excluding those IDs. For the full catalogue (assigned + unassigned) use " +
    "list_asset_products. For who-currently-has-what use list_assigned_assets.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: {
    version: "1.0.0",
    tags: ["assets", "products", "inventory", "unassigned", "available"],
  },

  handler: async (_input, ctx) => {
    const res = await apiPost<UnassignedResponse>(
      `${SERVICE.USERS}/getAllUnAssignedProducts`,
      {},
      ctx,
    );

    const records = res?.data?.data ?? [];
    const products: UnassignedProductSummary[] = records.map((p) => ({
      id: p.id ?? 0,
      name: p.name ?? "Unknown",
      brand: p.brand ?? null,
      model: p.model ?? null,
      serial_no: p.serial_no ?? null,
      warranty: p.warranty ?? null,
      purchase_date: p.purchase_date ?? null,
      status: p.status ?? "Active",
      asset_category_id: p.asset_category_id ?? null,
      category_breadcrumb: p.category?.breadcrumb ?? "",
      image_url: p.image_url_object ?? null,
    }));

    return { total: products.length, unassigned_products: products };
  },
};

toolRegistry.register(listUnassignedAssetProductsTool);
