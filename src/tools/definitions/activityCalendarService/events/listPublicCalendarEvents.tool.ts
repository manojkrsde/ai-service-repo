import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface CalendarEventSummary {
  id: number | string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  is_all_day: boolean;
  event_type: number;
  event_type_label: string;
  is_public: boolean;
  is_generated: boolean;
  user_id: number | null;
  years_of_service: number | null;
  status: number;
  created_at: string | null;
}

interface RawEvent {
  id?: number | string;
  title?: string;
  description?: string | null;
  start_date?: string;
  end_date?: string | null;
  is_all_day?: boolean;
  event_type?: number;
  is_public?: boolean;
  is_generated?: boolean;
  user_id?: number | null;
  years_of_service?: number | null;
  status?: number;
  createdAt?: string | null;
}

interface PublicEventsResponse {
  message: Array<{ msg: string; status: boolean; data: RawEvent[] }>;
}

interface ListPublicCalendarEventsResult {
  total: number;
  events: CalendarEventSummary[];
}

const EVENT_TYPE_LABEL: Record<number, string> = {
  1: "Meeting",
  2: "Holiday",
  3: "Birthday",
  4: "Appointment",
  5: "Work Anniversary",
  6: "Reminder",
};

const mapEvent = (e: RawEvent): CalendarEventSummary => ({
  id: e.id ?? 0,
  title: e.title ?? "Untitled",
  description: e.description ?? null,
  start_date: e.start_date ?? "",
  end_date: e.end_date ?? null,
  is_all_day: e.is_all_day ?? false,
  event_type: e.event_type ?? 0,
  event_type_label: EVENT_TYPE_LABEL[e.event_type ?? 0] ?? "Unknown",
  is_public: e.is_public ?? false,
  is_generated: e.is_generated ?? false,
  user_id: e.user_id ?? null,
  years_of_service: e.years_of_service ?? null,
  status: e.status ?? 1,
  created_at: e.createdAt ?? null,
});

export const listPublicCalendarEventsTool: ToolDefinition<
  typeof schema,
  ListPublicCalendarEventsResult
> = {
  name: "list_public_calendar_events",
  title:
    "Company calendar — holidays, birthdays, work anniversaries & shared events",
  description:
    "Returns the full company calendar: stored public events plus auto-generated birthdays " +
    "(event_type=3) and work anniversaries (event_type=5) synthesised server-side from each " +
    "employee's DOB / DOJ. Each event has a numeric event_type (1=meeting, 2=holiday, " +
    "3=birthday, 4=appointment, 5=anniversary, 6=reminder), is_all_day flag, dates, and an " +
    "is_generated flag distinguishing real DB events from on-the-fly birthday/anniversary rows. " +
    "\n\nUSE THIS TOOL TO: power the activity-calendar widget, answer 'whose birthday is " +
    "coming up', list this year's holidays, or summarise upcoming company events. " +
    "\n\nNOTE: For just upcoming items in next N days use get_upcoming_calendar_events — it's " +
    "narrower and faster. For only one event_type (e.g. holidays only) use list_holidays or " +
    "list_calendar_events_by_type. Birthday / anniversary entries have string IDs prefixed with " +
    "'birthday_' / 'anniversary_' and the corresponding `user_id`.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: {
    version: "1.0.0",
    tags: ["calendar", "events", "holidays", "birthdays", "anniversaries"],
  },

  handler: async (_input, ctx) => {
    const auth = ctx.sessionAuth;
    if (!auth) {
      throw new Error(
        "[AUTH_ERROR] Session credentials not available. Please re-initialize the MCP session.",
      );
    }

    const res = await apiPost<PublicEventsResponse>(
      `${SERVICE.ACTIVITY_CALENDAR}/getAllPublicEvents`,
      {
        company_id: String(auth.companyId),
        company_type: auth.companyType,
      },
      ctx,
      { injectCompanyContext: false },
    );

    const records = res?.message?.[0]?.data ?? [];
    const events = records.map(mapEvent);
    return { total: events.length, events };
  },
};

toolRegistry.register(listPublicCalendarEventsTool);
