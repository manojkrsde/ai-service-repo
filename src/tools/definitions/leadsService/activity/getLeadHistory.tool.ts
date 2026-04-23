/**
 * Answers: "Who owned this lead before? What stage changes has it had?"
 *
 * Wraps `/getHistoryData` — the detailed state-change audit trail
 * (assignments, stage moves, ownership changes).
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  lead_id: z
    .number()
    .int()
    .positive()
    .describe("The internal CRM ID of the lead whose history to fetch"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .default(50)
    .describe("Maximum number of history entries to return (most recent first)"),
});

interface HistoryEntry {
  id: number;
  change_type: string;
  previous_value: string | null;
  new_value: string | null;
  description: string;
  changed_by: number | null;
  changed_by_name: string;
  changed_at: string;
}

interface HistoryResult {
  lead_id: number;
  total_entries: number;
  returned: number;
  history: HistoryEntry[];
}

interface RawHistory {
  id?: number;
  change_type?: string;
  action?: string;
  type?: string;
  previous_value?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  description?: string;
  changed_by?: number | null;
  updated_by?: number | null;
  changed_by_name?: string;
  updated_by_name?: string;
  changed_at?: string;
  updated_at?: string;
  created_at?: string;
}

interface HistoryResponse {
  data?: RawHistory[];
}

export const getLeadHistoryTool: ToolDefinition<typeof schema, HistoryResult> =
  {
    name: "get_lead_history",
    title: "Get Lead History",
    description:
      "Returns the state-change audit trail for a lead — stage moves, " +
      "assignments, ownership changes, priority updates. Finer-grained than " +
      "get_lead_activity. Use when the user asks: Who owned this lead before? " +
      "What stage has it been through?",
    inputSchema: schema,
    annotations: { readOnlyHint: true, idempotentHint: true },
    meta: { version: "1.0.0", tags: ["leads", "history", "audit"] },

    handler: async (input, ctx) => {
      const res = await apiPost<HistoryResponse>(`${SERVICE.LEADS}/getHistoryData`,
        { lead_id: input.lead_id },
        ctx,
      );

      const raw = res.data ?? [];
      const mapped: HistoryEntry[] = raw.map((h) => ({
        id: h.id ?? 0,
        change_type: h.change_type ?? h.action ?? h.type ?? "unknown",
        previous_value: h.previous_value ?? h.old_value ?? null,
        new_value: h.new_value ?? null,
        description: h.description ?? "",
        changed_by: h.changed_by ?? h.updated_by ?? null,
        changed_by_name:
          h.changed_by_name ?? h.updated_by_name ?? "Unknown",
        changed_at:
          h.changed_at ?? h.updated_at ?? h.created_at ?? "",
      }));

      mapped.sort((a, b) => (a.changed_at < b.changed_at ? 1 : -1));
      const limited = mapped.slice(0, input.limit);

      return {
        lead_id: input.lead_id,
        total_entries: mapped.length,
        returned: limited.length,
        history: limited,
      };
    },
  };

toolRegistry.register(getLeadHistoryTool);
