import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface Holiday {
  id: number;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  is_all_day: boolean;
  status: number;
  created_at: string | null;
}

interface RawHoliday {
  id?: number;
  title?: string;
  description?: string | null;
  start_date?: string;
  end_date?: string | null;
  is_all_day?: boolean;
  status?: number;
  createdAt?: string | null;
}

interface HolidaysResponse {
  message: Array<{ msg: string; status: boolean; data: RawHoliday[] }>;
}

interface ListHolidaysResult {
  total: number;
  holidays: Holiday[];
}

export const listHolidaysTool: ToolDefinition<typeof schema, ListHolidaysResult> = {
  name: "list_holidays",
  title: "List company holidays — declared days off for the current company",
  description:
    "Returns the company's declared holidays (event_type = 2) sorted by start_date ascending. " +
    "Each entry has title, description, start/end dates, all-day flag, and status. " +
    "\n\nUSE THIS TOOL TO: answer 'what holidays do we have this year', show the next holiday, " +
    "or build a year-at-a-glance calendar. " +
    "\n\nNOTE: Returns ALL holidays (past + future). For only upcoming items use " +
    "get_upcoming_calendar_events with event_type=2. For other calendar event types use " +
    "list_calendar_events_by_type.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calendar", "holidays", "events"] },

  handler: async (_input, ctx) => {
    const auth = ctx.sessionAuth;
    if (!auth) {
      throw new Error(
        "[AUTH_ERROR] Session credentials not available. Please re-initialize the MCP session.",
      );
    }

    const res = await apiPost<HolidaysResponse>(
      `${SERVICE.ACTIVITY_CALENDAR}/getPublicHolidayByType`,
      {
        event_type: 2,
        company_id: String(auth.companyId),
        company_type: auth.companyType,
      },
      ctx,
      { injectCompanyContext: false },
    );

    const records = res?.message?.[0]?.data ?? [];
    const holidays: Holiday[] = records.map((h) => ({
      id: h.id ?? 0,
      title: h.title ?? "Untitled",
      description: h.description ?? null,
      start_date: h.start_date ?? "",
      end_date: h.end_date ?? null,
      is_all_day: h.is_all_day ?? false,
      status: h.status ?? 1,
      created_at: h.createdAt ?? null,
    }));

    return { total: holidays.length, holidays };
  },
};

toolRegistry.register(listHolidaysTool);
