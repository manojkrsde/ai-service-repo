import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface LocationSummary {
  id: number;
  location_name: string;
  building: string | null;
  floor: string | null;
  room: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

interface LocationRecord {
  id?: number;
  location_name?: string;
  building?: string | null;
  floor?: string | null;
  room?: string | null;
  status?: string;
  created_at?: string | null;
  updated_at?: string | null;
}

interface LocationsResponse {
  data: {
    data: LocationRecord[];
  };
}

interface ListLocationsResult {
  total: number;
  locations: LocationSummary[];
}

export const listLocationsTool: ToolDefinition<typeof schema, ListLocationsResult> = {
  name: "list_locations",
  title: "List company locations / sites — buildings, floors, rooms",
  description:
    "Returns every physical location registered for the company: building, floor, room, " +
    "and active/inactive status. Locations are used as targets when assigning assets " +
    "(via list_assigned_assets / get_assets_dashboard with assigned_to_type=location). " +
    "\n\nUSE THIS TOOL TO: list offices/sites, resolve a location_name → id before filtering an " +
    "asset query, or check whether a particular building/room is registered. " +
    "\n\nNOTE: Soft-deleted locations are excluded automatically. For department-level grouping " +
    "use list_departments instead.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["locations", "sites", "organization", "lookup"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<LocationsResponse>(
      `${SERVICE.USERS}/getLocation`,
      {},
      ctx,
    );

    const records = res?.data?.data ?? [];
    const locations: LocationSummary[] = records.map((l) => ({
      id: l.id ?? 0,
      location_name: l.location_name ?? "Unknown",
      building: l.building ?? null,
      floor: l.floor ?? null,
      room: l.room ?? null,
      status: l.status ?? "Active",
      created_at: l.created_at ?? null,
      updated_at: l.updated_at ?? null,
    }));

    return { total: locations.length, locations };
  },
};

toolRegistry.register(listLocationsTool);
