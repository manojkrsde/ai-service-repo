import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  event_id: z
    .number()
    .int()
    .positive()
    .describe(
      "Numeric ID of a stored calendar event. Generated birthday/anniversary entries (string IDs) cannot be looked up here.",
    ),
});

interface CalendarEventDetails {
  id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  is_all_day: boolean;
  event_type: number;
  is_public: boolean;
  status: number;
  created_by: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

interface RawEventDetails {
  id?: number;
  title?: string;
  description?: string | null;
  start_date?: string;
  end_date?: string | null;
  is_all_day?: boolean;
  event_type?: number;
  is_public?: boolean;
  status?: number;
  created_by?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface EventByIdResponse {
  message: Array<{ msg: string; status: boolean; data?: RawEventDetails }>;
}

export const getCalendarEventByIdTool: ToolDefinition<
  typeof schema,
  CalendarEventDetails
> = {
  name: "get_calendar_event_by_id",
  title: "Get a calendar event's details by ID — title, description, dates, type, visibility",
  description:
    "Returns a single calendar event by numeric ID with all stored fields: title, description, " +
    "start/end dates, all-day flag, event_type, public/private flag, creator info, and timestamps. " +
    "\n\nUSE THIS TOOL TO: drill into one event after list_public_calendar_events / " +
    "list_calendar_events_by_type returned a list, verify event details before suggesting an " +
    "edit, or fetch the full description text. " +
    "\n\nNOTE: Private events are only readable by their creator (server enforces — backend " +
    "returns 403 otherwise). Auto-generated birthday/anniversary entries have string IDs " +
    "(e.g. 'birthday_42') and CANNOT be fetched via this tool — they only exist in the " +
    "synthesised list_public_calendar_events response.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calendar", "events", "lookup"] },

  handler: async (input, ctx) => {
    const res = await apiPost<EventByIdResponse>(
      `${SERVICE.ACTIVITY_CALENDAR}/getEventById`,
      { id: input.event_id },
      ctx,
      { injectCompanyContext: false },
    );

    const r = res?.message?.[0]?.data ?? ({} as RawEventDetails);
    return {
      id: r.id ?? input.event_id,
      title: r.title ?? "Untitled",
      description: r.description ?? null,
      start_date: r.start_date ?? "",
      end_date: r.end_date ?? null,
      is_all_day: r.is_all_day ?? false,
      event_type: r.event_type ?? 0,
      is_public: r.is_public ?? false,
      status: r.status ?? 1,
      created_by: r.created_by ?? null,
      created_at: r.createdAt ?? null,
      updated_at: r.updatedAt ?? null,
    };
  },
};

toolRegistry.register(getCalendarEventByIdTool);
