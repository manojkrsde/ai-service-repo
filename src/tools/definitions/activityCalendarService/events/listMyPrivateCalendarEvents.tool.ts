import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface PrivateCalendarEvent {
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

interface RawPrivateEvent {
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

interface PrivateEventsResponse {
  message: Array<{ msg: string; status: boolean; data: RawPrivateEvent[] }>;
}

interface ListPrivateEventsResult {
  total: number;
  events: PrivateCalendarEvent[];
}

const EVENT_TYPE_LABEL: Record<number, string> = {
  1: "Meeting",
  2: "Holiday",
  3: "Birthday",
  4: "Appointment",
  5: "Work Anniversary",
  6: "Reminder",
};

export const listMyPrivateCalendarEventsTool: ToolDefinition<
  typeof schema,
  ListPrivateEventsResult
> = {
  name: "list_my_private_calendar_events",
  title: "User's private calendar events — personal reminders, appointments & meetings",
  description:
    "Returns the calling user's private (is_public=false) calendar events: personal meetings, " +
    "appointments, reminders, and any other event the user marked private. Each entry has " +
    "title, description, start/end dates, all-day flag, and event_type. " +
    "\n\nUSE THIS TOOL TO: list 'my upcoming personal events', see what private appointments " +
    "the user has on the calendar, or summarise their personal agenda. " +
    "\n\nNOTE: Strictly user-scoped server-side — only events with " +
    "`created_by.user_id == requesting user` are returned. For shared/company events use " +
    "list_public_calendar_events. For only the next N days use get_upcoming_calendar_events.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calendar", "events", "private", "personal"] },

  handler: async (_input, ctx) => {
    const auth = ctx.sessionAuth;
    if (!auth) {
      throw new Error(
        "[AUTH_ERROR] Session credentials not available. Please re-initialize the MCP session.",
      );
    }

    const res = await apiPost<PrivateEventsResponse>(
      `${SERVICE.ACTIVITY_CALENDAR}/getAllPrivateEvents`,
      {
        company_id: String(auth.companyId),
        company_type: auth.companyType,
      },
      ctx,
      { injectCompanyContext: false },
    );

    const records = res?.message?.[0]?.data ?? [];
    const events: PrivateCalendarEvent[] = records.map((e) => ({
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

    return { total: events.length, events };
  },
};

toolRegistry.register(listMyPrivateCalendarEventsTool);
