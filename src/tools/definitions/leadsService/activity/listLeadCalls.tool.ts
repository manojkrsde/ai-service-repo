import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  lead_id: z
    .number()
    .int()
    .positive()
    .describe("Lead id whose call history to fetch."),
});

interface LeadCall {
  id: number;
  agent_name: string;
  agent_image: string | null;
  call_status: string;
  note: string | null;
  duration: string | null;
  recording_url: string | null;
  date: string | null;
}

interface ListLeadCallsResult {
  lead_id: number;
  total: number;
  calls: LeadCall[];
}

interface RawLeadCall {
  id?: number;
  name?: string;
  image?: string | null;
  call_status?: string;
  note?: string | null;
  duration?: string | null;
  recording_url?: string | null;
  date?: string;
  createdAt?: string;
}

interface ListLeadCallsResponse {
  data?: { data?: RawLeadCall[] };
}

export const listLeadCallsTool: ToolDefinition<
  typeof schema,
  ListLeadCallsResult
> = {
  name: "list_lead_calls",
  title: "List call history for a lead — every connected/missed/outgoing call",
  description:
    "Returns every call recorded against the lead's phone number across the company's agents. " +
    "Each row carries: id, agent_name (full name resolved), agent_image, call_status (INCOMING " +
    "/ OUTGOING / MISSED / CONNECTED / etc.), note, duration, recording_url, and call date." +
    "\n\nUNDERSTANDING THE FLOW: Backend looks up the lead's mobile via the form-response row, " +
    "then asks the call-logs service over RabbitMQ for every call to/from that number scoped to " +
    "the company. Agents are joined from the user roster. company_id / company_type are auto-" +
    "injected." +
    "\n\nUSE THIS TOOL TO: render the call panel on a lead profile, summarise the most recent " +
    "outreach, or count attempts before escalating." +
    "\n\nNOTE: For all calls placed by ONE agent use `get_my_call_logs`. For both calls + notes + " +
    "stage changes use `get_lead_activity`.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leads", "calls", "list"] },

  handler: async (input, ctx) => {
    const res = await apiPost<ListLeadCallsResponse>(
      `${SERVICE.LEADS}/getLeadCalls`,
      { lead_id: input.lead_id },
      ctx,
    );

    const list = res?.data?.data ?? [];

    const calls: LeadCall[] = list.map((c) => ({
      id: c.id ?? 0,
      agent_name: c.name ?? "",
      agent_image: c.image ?? null,
      call_status: c.call_status ?? "UNKNOWN",
      note: c.note ?? null,
      duration: c.duration ?? null,
      recording_url: c.recording_url ?? null,
      date: c.date ?? c.createdAt ?? null,
    }));

    return { lead_id: input.lead_id, total: calls.length, calls };
  },
};

toolRegistry.register(listLeadCallsTool);
