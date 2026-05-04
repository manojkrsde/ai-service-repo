import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  state: z
    .string()
    .optional()
    .describe("Optional state filter to scope follow-ups by geography."),
  district: z
    .string()
    .optional()
    .describe("Optional district filter to scope follow-ups by geography."),
  form_id: z
    .union([z.string(), z.number()])
    .describe("Optional form ID to filter follow-ups by lead form."),
  pipeline_id: z
    .union([z.string(), z.number()])
    .optional()
    .describe("Optional pipeline ID to filter follow-ups by pipeline."),
  pipeline_char: z
    .string()
    .optional()
    .describe("Optional pipeline stage character/label filter."),
  page: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional page number for pagination."),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional page size for pagination."),
});

interface GetCallFollowUpsResult {
  data: Record<string, unknown> | unknown[];
}

interface FollowUpResponse {
  data?: Record<string, unknown> | unknown[];
}

export const getCallFollowUpsTool: ToolDefinition<
  typeof schema,
  GetCallFollowUpsResult
> = {
  name: "get_call_followups",
  title: "Get pending call follow-ups for the caller",
  description:
    "Returns the call follow-up details for the calling agent — call-back lists, scheduled " +
    "outreach, and prior commitments. All fields are optional: filter by `state`, `district`, " +
    "`form_id`, `pipeline_id`, `pipeline_char`, or paginate via `page` / `limit`. " +
    "The exact response shape comes from the call-logs follow-up RPC handler " +
    "(`followup_call_details` queue) and may include grouped buckets " +
    "(today / overdue / upcoming) plus per-call records." +
    "\n\nUNDERSTANDING THE FLOW: The handler ships the full request body via RabbitMQ to a " +
    "dedicated worker; if `req.id` (caller's user_id) is present it is auto-injected so the " +
    "result is scoped to the agent. company_id / company_type are auto-injected from session auth." +
    "\n\nUSE THIS TOOL TO: render an agent's daily follow-up queue, count pending callbacks, " +
    "or pre-populate a dialer with the next number to ring." +
    "\n\nNOTE: For lead-level reminders use `get_lead_follow_ups` (set lead_id to scope to one " +
    "lead). This tool answers the call-center side: who do I have to call back today?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calls", "followups"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {};
    if (input.state !== undefined) body["state"] = input.state;
    if (input.district !== undefined) body["district"] = input.district;
    if (input.form_id !== undefined) body["form_id"] = input.form_id;
    if (input.pipeline_id !== undefined)
      body["pipeline_id"] = input.pipeline_id;
    if (input.pipeline_char !== undefined)
      body["pipeline_char"] = input.pipeline_char;
    if (input.page !== undefined) body["page"] = input.page;
    if (input.limit !== undefined) body["limit"] = input.limit;

    const res = await apiPost<FollowUpResponse>(
      `${SERVICE.CALL_LOGS}/get-call-logs-followup`,
      body,
      ctx,
      {
        injectCompanyContext: true,
        companyContextKeyFormat: "camel_case",
      },
    );

    return { data: res?.data ?? [] };
  },
};

toolRegistry.register(getCallFollowUpsTool);
