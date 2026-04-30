import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface AssetsDashboardResult {
  assets: Array<Record<string, unknown>>;
  asset_history: Array<Record<string, unknown>>;
  metadata: {
    total_count: number;
    history_count: number;
    history_period: { start: string; end: string } | null;
    last_updated: string | null;
  };
}

interface DashboardResponse {
  data: {
    data: {
      assets?: Array<Record<string, unknown>>;
      assetHistory?: Array<Record<string, unknown>>;
      metadata?: {
        total_count?: number;
        history_count?: number;
        history_period?: { start: string; end: string };
        last_updated?: string;
      };
    };
  };
}

export const getAssetsDashboardTool: ToolDefinition<
  typeof schema,
  AssetsDashboardResult
> = {
  name: "get_assets_dashboard",
  title: "Asset inventory dashboard — counts, monthly activity, assignment & history snapshot",
  description:
    "Returns the consolidated asset dashboard payload that powers the frontend Assets dashboard: " +
    "every product in the catalogue with its current assignment state (assigned / in_stock / " +
    "idle), plus a deduplicated month-to-date asset-history feed showing each asset that " +
    "changed (with its latest action_type, total_changes count for the month, and the type of " +
    "change — assigned / unassigned / updated). Metadata block includes total counts, the " +
    "month period covered, and last-updated timestamp. " +
    "\n\nUSE THIS TOOL TO: answer 'how many assets do we have / how many are assigned / how " +
    "many are idle', see this month's activity (movements, assignments, retirements), or feed " +
    "an executive asset summary. " +
    "\n\nNOTE: `history_period` is the current calendar month — start of month → end of month. " +
    "For the full lifetime audit of a single asset use get_asset_with_history. For an " +
    "employee-scoped view use get_employee_assigned_assets.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: {
    version: "1.0.0",
    tags: ["assets", "analytics", "dashboard", "inventory"],
  },

  handler: async (_input, ctx) => {
    const res = await apiPost<DashboardResponse>(
      `${SERVICE.ASSETS}/dashboard-data`,
      {},
      ctx,
    );

    const inner = res?.data?.data ?? {};
    return {
      assets: inner.assets ?? [],
      asset_history: inner.assetHistory ?? [],
      metadata: {
        total_count: inner.metadata?.total_count ?? 0,
        history_count: inner.metadata?.history_count ?? 0,
        history_period: inner.metadata?.history_period ?? null,
        last_updated: inner.metadata?.last_updated ?? null,
      },
    };
  },
};

toolRegistry.register(getAssetsDashboardTool);
