import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  asset_id: z
    .number()
    .int()
    .positive()
    .describe(
      "ID of the assigned-asset record to fetch. Use list_assigned_assets to discover IDs.",
    ),
});

interface AssignedAssetDetails {
  id: number;
  product_id: string;
  product_name: string;
  product_brand: string;
  product_model: string;
  product_warranty: string;
  product_purchase_date: string;
  product_purchase_from: string;
  company_id: string;
  company_name: string;
  company_type: string;
  serial_no: string;
  assigned_date: string;
  unassigned_date: string;
  assigned_by: string;
  assigned_by_name: string;
  assigned_by_logo: string | null;
}

interface AssetDetailsResponse {
  data: {
    data: AssignedAssetDetails;
  };
}

export const getAssignedAssetDetailsTool: ToolDefinition<
  typeof schema,
  AssignedAssetDetails
> = {
  name: "get_assigned_asset_details",
  title:
    "Get details of a single assigned asset — product, company, assigner, dates & serial",
  description:
    "Returns the enriched record for one assigned asset: product details (name, brand, model, " +
    "warranty, purchase date/source), the company it belongs to, who assigned it (user name + " +
    "profile picture), assignment / unassignment dates, and serial number. " +
    "\n\nUSE THIS TOOL TO: drill into one specific asset after list_assigned_assets gave you an " +
    "ID, verify product warranty / serial, or look up who originally assigned an item. " +
    "\n\nNOTE: For the asset's full assignment history (every reassignment, status change, " +
    "ownership change) use get_asset_with_history — this tool returns only the current state. " +
    "Missing upstream data is returned as 'N/A' rather than null.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["assets", "lookup", "details"] },

  handler: async (input, ctx) => {
    const res = await apiPost<AssetDetailsResponse>(
      `${SERVICE.ASSETS}/getAssignedAssetDetails`,
      { id: input.asset_id },
      ctx,
      { injectCompanyContext: false },
    );

    return res?.data?.data ?? ({} as AssignedAssetDetails);
  },
};

toolRegistry.register(getAssignedAssetDetailsTool);
