import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  status: z
    .enum(["all", "todo", "in-progress", "pending", "completed"])
    .default("all")
    .describe(
      "Operational status filter. 'all' returns every assigned ticket; " +
        "'todo'=1, 'in-progress'=2, 'pending'=3, 'completed'=4.",
    ),
  priority: z
    .enum(["all", "high", "medium", "low"])
    .default("all")
    .describe(
      "Priority filter. 'all' = no filter; high=2, medium=3, low=1 internally.",
    ),
  search: z
    .string()
    .optional()
    .describe(
      "Optional case-insensitive substring search across title and description.",
    ),
});

interface AssignedTicket {
  id: number;
  title: string;
  description: string | null;
  category: string;
  category_id: number | null;
  priority: string;
  status: string;
  operation_status: number | null;
  raised_by: number | null;
  raised_date: string | null;
  due_date: string | null;
  last_updated: string | null;
  progress: number;
  product_id: number | null;
  company_id: number | null;
  company_type: string | null;
  is_overdue: boolean;
}

interface ListMyAssignedTicketsResult {
  total: number;
  tickets: AssignedTicket[];
}

interface BackendMessageItem {
  msg?: string;
  status?: boolean;
  data?: AssignedTicket[];
}

interface BackendEnvelope {
  message?: BackendMessageItem[] | BackendMessageItem;
}

function pickFirst(env: BackendEnvelope | undefined): BackendMessageItem {
  const m = env?.message;
  if (Array.isArray(m)) return m[0] ?? {};
  if (m && typeof m === "object") return m;
  return {};
}

export const listMyAssignedTicketsTool: ToolDefinition<
  typeof schema,
  ListMyAssignedTicketsResult
> = {
  name: "list_my_assigned_tickets",
  title: "List tickets assigned to the caller — pre-formatted for dashboards",
  description:
    "Returns only the tickets where `assigned_to` is the calling user (across visible " +
    "companies). Each row is pre-formatted for UI consumption: textual `category` (joined " +
    "from m_tickets_category), textual `priority` (high/medium/low), textual `status` " +
    "(in-progress/pending/completed), numeric `progress` (50/75/100), and an `is_overdue` " +
    "flag computed against `due_date`. Optional filters: status, priority, search (matches " +
    "title or description case-insensitively)." +
    "\n\nUNDERSTANDING THE FLOW: Backend resolves visible companies via RabbitMQ and joins " +
    "categories in a second query. Only operation_status in (2,3,4) is returned (todo/raw " +
    "items are excluded). company_id / company_type are auto-injected from session auth." +
    "\n\nUSE THIS TOOL TO: build a 'my work' dashboard, count overdue items, summarise the " +
    "caller's queue, or feed an LLM a list of tickets to triage." +
    "\n\nNOTE: For the unfiltered, raw-shape ticket list across the company use `list_tickets`. " +
    "For aggregate counts use `get_ticket_counts` or `get_ticket_statistics`.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["tickets", "assigned", "list"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      status: input.status,
      priority: input.priority,
    };
    if (input.search !== undefined) body["search"] = input.search;

    const res = await apiPost<BackendEnvelope>(
      `${SERVICE.TICKETS}/getAssignedTickets`,
      body,
      ctx,
    );

    const list = pickFirst(res).data ?? [];

    return { total: list.length, tickets: list };
  },
};

toolRegistry.register(listMyAssignedTicketsTool);
