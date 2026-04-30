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
      "Assigned-asset ID. Use list_assigned_assets to discover IDs.",
    ),
});

interface AssetWithHistoryResult {
  asset: Record<string, unknown>;
  history: Array<Record<string, unknown>>;
  history_count: number;
}

interface AssetWithHistoryResponse {
  data: {
    data: {
      asset?: Record<string, unknown>;
      history?: Array<Record<string, unknown>>;
    };
  };
}

export const getAssetWithHistoryTool: ToolDefinition<
  typeof schema,
  AssetWithHistoryResult
> = {
  name: "get_asset_with_history",
  title:
    "Get an asset with its full audit trail — every reassignment, status change & action",
  description:
    "Returns the asset's current enriched state PLUS the complete history of every action ever " +
    "logged against it: who did what, when, and why. Each history entry has an `action_type` " +
    "from this set: ASSIGNED, REASSIGNED, OWNERSHIP_CHANGED, LOCATION_CHANGED, UNASSIGNED, " +
    "DELETED, LOST, MAINTENANCE, RETURNED, RECOVERED, REPAIRED, UPDATED, CREATED. History is " +
    "sorted newest-first. " +
    "\n\nUSE THIS TOOL TO: answer 'who had this laptop before me', audit the lifetime of a " +
    "specific asset, investigate when an item went into maintenance, or trace ownership for " +
    "compliance. " +
    "\n\nNOTE: Soft-deleted assets are filtered out (status=2). Enrichment of history rows " +
    "depends on upstream RabbitMQ lookups; failures are non-blocking and may show as 'N/A'. For " +
    "current-state-only use get_assigned_asset_details — it's lighter.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["assets", "history", "audit", "compliance"] },

  handler: async (input, ctx) => {
    const auth = ctx.sessionAuth;
    if (!auth) {
      throw new Error(
        "[AUTH_ERROR] Session credentials not available. Please re-initialize the MCP session.",
      );
    }

    const res = await apiPost<AssetWithHistoryResponse>(
      `${SERVICE.ASSETS}/getAssetDetailsWithHistory`,
      {
        id: input.asset_id,
        company_id: auth.companyId,
        company_type: auth.companyType,
      },
      ctx,
      { injectCompanyContext: false },
    );

    const inner = res?.data?.data ?? {};
    const history = inner.history ?? [];
    return {
      asset: inner.asset ?? {},
      history,
      history_count: history.length,
    };
  },
};

toolRegistry.register(getAssetWithHistoryTool);
