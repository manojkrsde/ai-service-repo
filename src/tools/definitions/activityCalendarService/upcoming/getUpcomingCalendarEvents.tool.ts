import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  days_ahead: z
    .number()
    .int()
    .min(1)
    .max(365)
    .default(30)
    .describe("Window size in days from today (1-365). Default 30."),
  event_type: z
    .number()
    .int()
    .min(1)
    .max(6)
    .optional()
    .describe(
      "Optional filter: 1=meeting, 2=holiday, 3=birthday, 4=appointment, 5=anniversary, 6=reminder.",
    ),
});

interface UpcomingEvent {
  id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  is_all_day: boolean;
  event_type: number;
  event_type_label: string;
  status: number;
  created_at: string | null;
}

interface RawEvent {
  id?: number;
  title?: string;
  description?: string | null;
  start_date?: string;
  end_date?: string | null;
  is_all_day?: boolean;
  event_type?: number;
  status?: number;
  createdAt?: string | null;
}

interface UpcomingResponse {
  message: Array<{ msg: string; status: boolean; data: RawEvent[] }>;
}

interface GetUpcomingResult {
  days_ahead: number;
  total: number;
  events: UpcomingEvent[];
}

const EVENT_TYPE_LABEL: Record<number, string> = {
  1: "Meeting",
  2: "Holiday",
  3: "Birthday",
  4: "Appointment",
  5: "Work Anniversary",
  6: "Reminder",
};

export const getUpcomingCalendarEventsTool: ToolDefinition<
  typeof schema,
  GetUpcomingResult
> = {
  name: "get_upcoming_calendar_events",
  title:
    "Upcoming calendar events in next N days — holidays, meetings, anniversaries (max 50)",
  description:
    "Returns at most 50 upcoming public calendar events whose start_date falls between today " +
    "and today + days_ahead (default 30). Sorted ascending by start_date. Optionally narrow to " +
    "a single event_type (1=meeting, 2=holiday, 3=birthday, 4=appointment, 5=anniversary, " +
    "6=reminder). " +
    "\n\nUSE THIS TOOL TO: power 'what's coming up' summaries, dashboard upcoming-events widgets, " +
    "or 'next 7 days' agenda answers. " +
    "\n\nNOTE: Stored events only — server does NOT inject auto-generated birthdays/anniversaries " +
    "into this list (those only appear in list_public_calendar_events). For private personal " +
    "events use list_my_private_calendar_events. Capped at 50 records by the backend.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: {
    version: "1.0.0",
    tags: ["calendar", "events", "upcoming", "agenda"],
  },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = { days_ahead: input.days_ahead };
    if (input.event_type !== undefined) body["event_type"] = input.event_type;

    const res = await apiPost<UpcomingResponse>(
      `${SERVICE.ACTIVITY_CALENDAR}/getUpcomingPublicEvents`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    const records = res?.message?.[0]?.data ?? [];
    const events: UpcomingEvent[] = records.map((e) => ({
      id: e.id ?? 0,
      title: e.title ?? "Untitled",
      description: e.description ?? null,
      start_date: e.start_date ?? "",
      end_date: e.end_date ?? null,
      is_all_day: e.is_all_day ?? false,
      event_type: e.event_type ?? 0,
      event_type_label: EVENT_TYPE_LABEL[e.event_type ?? 0] ?? "Unknown",
      status: e.status ?? 1,
      created_at: e.createdAt ?? null,
    }));

    return { days_ahead: input.days_ahead, total: events.length, events };
  },
};

toolRegistry.register(getUpcomingCalendarEventsTool);
