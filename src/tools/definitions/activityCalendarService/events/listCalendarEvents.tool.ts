import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  scope: z
    .enum(["public", "private"])
    .default("public")
    .describe(
      "'public' = company calendar (holidays, anniversaries, shared events). 'private' = caller's own personal events.",
    ),
  event_type: z
    .number()
    .int()
    .min(1)
    .max(6)
    .optional()
    .describe(
      "Optional filter: 1=meeting, 2=holiday, 3=birthday, 4=appointment, 5=work anniversary, 6=reminder. Omit for all types. Note: birthdays (3) and anniversaries (5) are auto-generated only on the public scope without a type filter; setting event_type=3 or 5 returns an empty list.",
    ),
  days_ahead: z
    .number()
    .int()
    .min(1)
    .max(365)
    .optional()
    .describe(
      "Optional: only return events whose start_date falls within the next N days. Omit for the full list. Backend caps upcoming results at 50.",
    ),
});

type Input = z.infer<typeof schema>;

interface CalendarEvent {
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

interface ListCalendarEventsResult {
  scope: "public" | "private";
  event_type?: number;
  days_ahead?: number;
  total: number;
  events: CalendarEvent[];
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

interface BackendMessageItem {
  msg?: string;
  status?: boolean;
  data?: RawEvent[];
}

interface BackendEnvelope {
  message?: BackendMessageItem[] | BackendMessageItem;
}

const EVENT_TYPE_LABEL: Record<number, string> = {
  1: "Meeting",
  2: "Holiday",
  3: "Birthday",
  4: "Appointment",
  5: "Work Anniversary",
  6: "Reminder",
};

const ALIAS_DEFAULTS: Record<string, Partial<Input>> = {
  list_holidays: { scope: "public", event_type: 2 },
  get_upcoming_calendar_events: { scope: "public", days_ahead: 30 },
  list_my_private_calendar_events: { scope: "private" },
  list_private_events_by_type: { scope: "private" },
  get_upcoming_private_events: { scope: "private", days_ahead: 30 },
};

function pickFirst(env: BackendEnvelope | undefined): BackendMessageItem {
  const m = env?.message;
  if (Array.isArray(m)) return m[0] ?? {};
  if (m && typeof m === "object") return m;
  return {};
}

function mapEvent(raw: RawEvent, fallbackType?: number): CalendarEvent {
  const eventType = raw.event_type ?? fallbackType ?? 0;
  return {
    id: raw.id ?? 0,
    title: raw.title ?? "Untitled",
    description: raw.description ?? null,
    start_date: raw.start_date ?? "",
    end_date: raw.end_date ?? null,
    is_all_day: raw.is_all_day ?? false,
    event_type: eventType,
    event_type_label: EVENT_TYPE_LABEL[eventType] ?? "Unknown",
    is_public: raw.is_public ?? false,
    is_generated: raw.is_generated ?? false,
    user_id: raw.user_id ?? null,
    years_of_service: raw.years_of_service ?? null,
    status: raw.status ?? 1,
    created_at: raw.createdAt ?? null,
  };
}

export const listCalendarEventsTool: ToolDefinition<
  typeof schema,
  ListCalendarEventsResult
> = {
  name: "list_calendar_events",
  title:
    "Calendar events — public (holidays, meetings, anniversaries) or private, optionally filtered by type and time window",
  description:
    "Returns calendar events for the company (public scope) or for the caller (private scope). " +
    "Each event has id, title, description, start/end dates, all-day flag, event_type with label, " +
    "is_public and is_generated flags, user_id (for birthdays/anniversaries), and creation timestamp. " +
    "When scope='public' and no filters are set, the backend additionally synthesises birthday and " +
    "work-anniversary rows from each employee's DOB / DOJ. " +
    "\n\nUse this to: power calendar widgets, list 'this month's holidays', surface 'next 7 days' " +
    "agendas, or show personal upcoming reminders. Combine event_type and days_ahead to narrow.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: {
    version: "1.0.0",
    tags: ["calendar", "events", "holidays", "birthdays", "anniversaries"],
  },
  aliases: [
    "list_public_calendar_events",
    "list_calendar_events_by_type",
    "list_holidays",
    "get_upcoming_calendar_events",
    "list_my_private_calendar_events",
    "list_private_events_by_type",
    "get_upcoming_private_events",
  ],

  handler: async (input, ctx) => {
    const aliasDefaults = ctx.invokedName
      ? ALIAS_DEFAULTS[ctx.invokedName]
      : undefined;
    const scope = input.scope ?? aliasDefaults?.scope ?? "public";
    const event_type = input.event_type ?? aliasDefaults?.event_type;
    const days_ahead = input.days_ahead ?? aliasDefaults?.days_ahead;

    const auth = ctx.sessionAuth;
    if (!auth) {
      throw new Error(
        "[AUTH_ERROR] Session credentials not available. Please re-initialize the MCP session.",
      );
    }

    let path: string;
    const body: Record<string, unknown> = {};
    let injectCompany = true;

    if (scope === "public") {
      if (days_ahead !== undefined) {
        path = `${SERVICE.ACTIVITY_CALENDAR}/getUpcomingPublicEvents`;
        body["days_ahead"] = days_ahead;
        if (event_type !== undefined) body["event_type"] = event_type;
        injectCompany = false;
      } else if (event_type !== undefined) {
        path = `${SERVICE.ACTIVITY_CALENDAR}/getPublicEventsByType`;
        body["event_type"] = event_type;
      } else {
        path = `${SERVICE.ACTIVITY_CALENDAR}/getAllPublicEvents`;
        body["company_id"] = String(auth.companyId);
        body["company_type"] = auth.companyType;
        injectCompany = false;
      }
    } else {
      if (days_ahead !== undefined) {
        path = `${SERVICE.ACTIVITY_CALENDAR}/getUpcomingPrivateEvents`;
        body["days_ahead"] = days_ahead;
        if (event_type !== undefined) body["event_type"] = event_type;
      } else if (event_type !== undefined) {
        path = `${SERVICE.ACTIVITY_CALENDAR}/getPrivateEventsByType`;
        body["event_type"] = event_type;
      } else {
        path = `${SERVICE.ACTIVITY_CALENDAR}/getAllPrivateEvents`;
        body["company_id"] = String(auth.companyId);
        body["company_type"] = auth.companyType;
        injectCompany = false;
      }
    }

    const res = await apiPost<BackendEnvelope>(
      path,
      body,
      ctx,
      injectCompany ? undefined : { injectCompanyContext: false },
    );

    const records = pickFirst(res).data ?? [];
    const events = records.map((r) => mapEvent(r, event_type));

    const result: ListCalendarEventsResult = {
      scope,
      total: events.length,
      events,
    };
    if (event_type !== undefined) result.event_type = event_type;
    if (days_ahead !== undefined) result.days_ahead = days_ahead;
    return result;
  },
};

toolRegistry.register(listCalendarEventsTool);
