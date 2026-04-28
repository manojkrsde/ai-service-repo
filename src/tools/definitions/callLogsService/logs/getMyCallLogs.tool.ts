/**
 * Returns the calling user's own call logs over a date range.
 *
 * Wraps POST /getCustomerLogs. Backend (call-logs-services) reads the user
 * from the JWT (`req.id`), so company / user scoping is implicit — the body
 * accepts only signature + start_date + end_date and Joi rejects unknown
 * keys. Therefore company-context injection is suppressed.
 *
 * Backend joins each row with the user's email + display name from a
 * RabbitMQ user-info lookup, and call_type is returned as a numeric code
 * (1=Incoming, 2=Outgoing, 3=Missed, 4=Voicemail, 5=Rejected, 6=Blocked,
 * 7=Answered Externally) — mapped to a label here for LLM readability.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  start_date: z
    .string()
    .describe("Start date in YYYY-MM-DD format (inclusive)."),
  end_date: z.string().describe("End date in YYYY-MM-DD format (inclusive)."),
});

interface CallLogItem {
  user_id: number;
  call_duration: number;
  customer_mobile: string;
  url: string | null;
  start_time: string;
  end_time: string;
  call_type: number;
  call_type_label: string;
  username: string | null;
  name: string | null;
}

interface GetMyCallLogsResult {
  start_date: string;
  end_date: string;
  returned: number;
  calls: CallLogItem[];
}

interface CallLogRecord {
  user_id?: number;
  call_duration?: number;
  customer_mobile?: string;
  url?: string | null;
  start_time?: string;
  end_time?: string;
  call_type?: number;
  username?: string | null;
  name?: string | null;
}

interface GetMyCallLogsResponse {
  msg?: string;
  data?: CallLogRecord[];
}

const CALL_TYPE_LABELS: Record<number, string> = {
  1: "Incoming",
  2: "Outgoing",
  3: "Missed",
  4: "Voicemail",
  5: "Rejected",
  6: "Blocked",
  7: "Answered Externally",
};

export const getMyCallLogsTool: ToolDefinition<
  typeof schema,
  GetMyCallLogsResult
> = {
  name: "get_my_call_logs",
  title:
    "Get my call logs — every call placed/received by me in a date range",
  description:
    "Returns the calling user's own call logs between start_date and end_date. Each row " +
    "includes customer_mobile, call_duration (seconds), start_time, end_time, recording url, " +
    "call_type (numeric 1-7) plus a human-readable call_type_label, and the user's email + " +
    "display name. " +
    "\n\nUNDERSTANDING THE FLOW: This endpoint is hard-scoped to the caller via the JWT — " +
    "there is no way to fetch another user's logs from this tool. The backend rejects any " +
    "company/user filters in the body. To fetch a different user's calls (admin view), use " +
    "list_calls_by_type with their user_id, or get_daily_call_stats with user_ids. " +
    "\n\nUSE THIS TOOL TO: answer 'how many calls did I make this week?', 'what numbers did I " +
    "talk to today?', 'did I miss any calls yesterday?'. Use list_calls_by_type if you need to " +
    "filter to only INCOMING / OUTGOING / MISSED / CONNECTED. " +
    "\n\nNOTE: call_type is a numeric code; call_type_label is the friendly form. Backend " +
    "rejects requests if the caller's department doesn't match the company's call-management " +
    "department setting — surface that error verbatim if it happens.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calls", "logs"] },

  handler: async (input, ctx) => {
    const res = await apiPost<GetMyCallLogsResponse>(
      `${SERVICE.CALL_LOGS}/getCustomerLogs`,
      { start_date: input.start_date, end_date: input.end_date },
      ctx,
      { injectCompanyContext: false },
    );

    const records = res.data ?? [];

    const calls: CallLogItem[] = records.map((r) => ({
      user_id: r.user_id ?? 0,
      call_duration: r.call_duration ?? 0,
      customer_mobile: r.customer_mobile ?? "",
      url: r.url ?? null,
      start_time: r.start_time ?? "",
      end_time: r.end_time ?? "",
      call_type: r.call_type ?? 0,
      call_type_label: CALL_TYPE_LABELS[r.call_type ?? 0] ?? "Unknown",
      username: r.username ?? null,
      name: r.name ?? null,
    }));

    return {
      start_date: input.start_date,
      end_date: input.end_date,
      returned: calls.length,
      calls,
    };
  },
};

toolRegistry.register(getMyCallLogsTool);
