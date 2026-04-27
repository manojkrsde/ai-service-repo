/**
 * Lists a user's call logs filtered by call type within a date range.
 *
 * Wraps POST /getUserCallLogsByType. Backend Joi requires:
 *   signature, type, start_date, end_date, user_id, company_id, company_type.
 * Therefore default company-context injection (snake_case) is left on.
 *
 * `type` is an enum string the backend resolves to either a numeric
 * call_type (1-7) or one of four synthetic categories handled in code:
 * CONNECTED (any call with duration > 0 and call_type != 3),
 * NOTCONNECTED (duration = 0 and call_type in 2,3),
 * ALL (no type filter, just the date+user filter),
 * CONNECTED_MISSED (numbers that have BOTH a missed call and a later
 * connected call with the same normalised digits).
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const CALL_TYPE_ENUM = z.enum([
  "INCOMING",
  "OUTGOING",
  "MISSED",
  "VOICEMAIL",
  "REJECTED",
  "BLOCKED",
  "ANSWERED_EXTERNALLY",
  "CONNECTED",
  "NOTCONNECTED",
  "ALL",
  "CONNECTED_MISSED",
]);

const schema = z.object({
  user_id: z
    .number()
    .int()
    .positive()
    .describe(
      "Employee user ID whose call logs to fetch. Use list_employees to resolve a name to an ID.",
    ),
  type: CALL_TYPE_ENUM.describe(
    "Call category to filter on. " +
      "Real types: INCOMING, OUTGOING, MISSED, VOICEMAIL, REJECTED, BLOCKED, ANSWERED_EXTERNALLY. " +
      "Synthetic: CONNECTED (any call answered, duration > 0), NOTCONNECTED (outgoing/missed with " +
      "0 duration), ALL (no type filter), CONNECTED_MISSED (numbers that were missed AND later " +
      "connected — i.e. 'returned' missed calls).",
  ),
  start_date: z
    .string()
    .describe("Start date in YYYY-MM-DD format (inclusive)."),
  end_date: z.string().describe("End date in YYYY-MM-DD format (inclusive)."),
});

interface CallRow {
  id: number;
  user_id: number;
  call_duration: number;
  customer_mobile: string;
  url: string | null;
  start_time: string;
  end_time: string;
  call_type: number;
  call_date: string;
}

interface ListCallsByTypeResult {
  user_id: number;
  type: string;
  start_date: string;
  end_date: string;
  returned: number;
  calls: CallRow[];
}

interface CallRecord {
  id?: number;
  user_id?: number;
  call_duration?: number;
  customer_mobile?: string;
  url?: string | null;
  start_time?: string;
  end_time?: string;
  call_type?: number;
  call_date?: string;
}

interface ListCallsByTypeResponse {
  msg?: string;
  data?: CallRecord[];
}

export const listCallsByTypeTool: ToolDefinition<
  typeof schema,
  ListCallsByTypeResult
> = {
  name: "list_calls_by_type",
  title:
    "List calls by type — INCOMING / OUTGOING / MISSED / CONNECTED / etc. for a user",
  description:
    "Returns one user's call logs filtered by call category over a date range. Each row " +
    "includes id, customer_mobile, call_duration, start_time, end_time, call_type, call_date. " +
    "Categories include the seven raw call types (INCOMING, OUTGOING, MISSED, VOICEMAIL, " +
    "REJECTED, BLOCKED, ANSWERED_EXTERNALLY) and four synthetic ones (CONNECTED, NOTCONNECTED, " +
    "ALL, CONNECTED_MISSED — calls that were missed and later returned). " +
    "\n\nUNDERSTANDING THE FLOW: A user_id is required — this is the audit/admin view of any " +
    "single employee's calls. To see your own calls without a date filter, use " +
    "get_my_call_logs (which is hard-scoped to the caller). The backend uses NUMERIC type " +
    "codes internally but expects the string enum here. " +
    "\n\nUSE THIS TOOL TO: answer 'how many missed calls did Rahul have last week?', " +
    "'show me Priya's outgoing calls today', 'which numbers did employee 42 connect to in " +
    "March?'. Combine with get_daily_call_stats for aggregates rather than row-level detail. " +
    "\n\nNOTE: Backend rejects requests if the caller's department doesn't match the " +
    "company's call-management department setting. Date format is strictly YYYY-MM-DD.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calls", "logs"] },

  handler: async (input, ctx) => {
    const res = await apiPost<ListCallsByTypeResponse>(
      `${SERVICE.CALL_LOGS}/getUserCallLogsByType`,
      {
        user_id: input.user_id,
        type: input.type,
        start_date: input.start_date,
        end_date: input.end_date,
      },
      ctx,
    );

    const records = res.data ?? [];
    const calls: CallRow[] = records.map((r) => ({
      id: r.id ?? 0,
      user_id: r.user_id ?? input.user_id,
      call_duration: r.call_duration ?? 0,
      customer_mobile: r.customer_mobile ?? "",
      url: r.url ?? null,
      start_time: r.start_time ?? "",
      end_time: r.end_time ?? "",
      call_type: r.call_type ?? 0,
      call_date: r.call_date ?? "",
    }));

    return {
      user_id: input.user_id,
      type: input.type,
      start_date: input.start_date,
      end_date: input.end_date,
      returned: calls.length,
      calls,
    };
  },
};

toolRegistry.register(listCallsByTypeTool);
