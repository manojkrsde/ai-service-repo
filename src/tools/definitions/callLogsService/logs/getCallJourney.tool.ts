/**
 * Returns every call between one user and one customer mobile.
 *
 * Wraps POST /getCallJourney. The backend route has NO middleware
 * registered (see call_logs_routes.js: `server.post("/getCallJourney",
 * controller.getCallJourney)`), so Joi does not run. Auth still works —
 * apiPost attaches the JWT/signature — but the backend itself doesn't
 * verify them. Treat the data as company-trustworthy only as far as the
 * caller chooses to be honest about user_id / company_id.
 *
 * Each row includes a derived `call_event` field built in SQL:
 *   1 → 'Incoming', 2 → 'Outgoing', 3 → 'Missed',
 *   duration > 0 → 'Connected', else 'Not Connected'.
 * Ordered by start_time DESC.
 *
 * Phone matching is exact (`customer_mobile = :mobile`); the tool does NOT
 * normalise the phone before sending so the caller can pass exactly the
 * stored format. Use search_call_contacts first if the exact stored
 * format is unknown.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  user_id: z
    .number()
    .int()
    .positive()
    .describe(
      "The employee whose calls with this customer to fetch. Use list_employees to resolve a name to an ID.",
    ),
  customer_mobile: z
    .string()
    .min(3)
    .describe(
      "Exact customer mobile number as stored in t_user_call_logs.customer_mobile " +
        "(matched literally, no normalisation). If unsure, run search_call_contacts first.",
    ),
});

interface JourneyRow {
  id: number;
  user_id: number;
  call_type: number;
  call_duration: number;
  start_time: string;
  end_time: string;
  call_date: string;
  customer_mobile: string;
  call_event: string;
}

interface GetCallJourneyResult {
  user_id: number;
  customer_mobile: string;
  returned: number;
  total_duration: number;
  calls: JourneyRow[];
}

interface JourneyRecord {
  id?: number;
  user_id?: number;
  call_type?: number;
  call_duration?: number;
  start_time?: string;
  end_time?: string;
  call_date?: string;
  norm_mobile?: string;
  call_event?: string;
}

interface GetCallJourneyResponse {
  msg?: string;
  data?: JourneyRecord[];
}

export const getCallJourneyTool: ToolDefinition<
  typeof schema,
  GetCallJourneyResult
> = {
  name: "get_call_journey",
  title:
    "Get call journey — every call between one employee and one customer mobile",
  description:
    "Returns the full call history between a single employee (user_id) and a single customer " +
    "mobile, ordered by start_time DESC. Each row includes id, call_type (numeric), " +
    "call_duration, start_time, end_time, call_date, customer_mobile, plus a derived " +
    "call_event label: 'Incoming', 'Outgoing', 'Missed', 'Connected' (any other type with " +
    "duration > 0), or 'Not Connected'. Also returns total_duration across the journey. " +
    "\n\nUNDERSTANDING THE FLOW: Phone match is EXACT against the stored customer_mobile — " +
    "no '+91' or leading-zero normalisation is applied here. If the customer's number is " +
    "stored as '+919876543210' in one row and '9876543210' in another, you'll need two calls " +
    "or a search via search_call_contacts to find the canonical form first. user_id is " +
    "required and is the employee side of the conversation — there is no 'all employees' mode. " +
    "\n\nUSE THIS TOOL TO: answer 'when did Rahul last call this customer?', 'what's the " +
    "history of conversations with +919812345678?', 'how many minutes have we spent on this " +
    "lead?'. " +
    "\n\nNOTE: Backend has NO authentication middleware on this route — security relies on " +
    "the caller passing honest IDs. Do not surface this caveat to end users; just be aware " +
    "that the data is not separately access-checked. The query uses company_id/company_type " +
    "from the request body (auto-injected by this tool).",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calls", "logs"] },

  handler: async (input, ctx) => {
    const res = await apiPost<GetCallJourneyResponse>(
      `${SERVICE.CALL_LOGS}/getCallJourney`,
      {
        user_id: input.user_id,
        customer_mobile: input.customer_mobile,
      },
      ctx,
    );

    const records = res.data ?? [];
    const calls: JourneyRow[] = records.map((r) => ({
      id: r.id ?? 0,
      user_id: r.user_id ?? input.user_id,
      call_type: r.call_type ?? 0,
      call_duration: r.call_duration ?? 0,
      start_time: r.start_time ?? "",
      end_time: r.end_time ?? "",
      call_date: r.call_date ?? "",
      customer_mobile: r.norm_mobile ?? input.customer_mobile,
      call_event: r.call_event ?? "Unknown",
    }));

    const total_duration = calls.reduce((sum, c) => sum + c.call_duration, 0);

    return {
      user_id: input.user_id,
      customer_mobile: input.customer_mobile,
      returned: calls.length,
      total_duration,
      calls,
    };
  },
};

toolRegistry.register(getCallJourneyTool);
