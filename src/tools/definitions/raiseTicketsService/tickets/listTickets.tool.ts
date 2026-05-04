import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface TicketSummary {
  id: number;
  title: string;
  description: string | null;
  category_id: number | null;
  operation_status: number | null;
  status: number | null;
  raised_by: number | null;
  assigned_to: number | null;
  product_id: number | null;
  priority: number | null;
  company_id: number | null;
  company_type: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ListTicketsResult {
  total: number;
  tickets: TicketSummary[];
}

interface TicketRow {
  id?: number;
  title?: string;
  description?: string | null;
  category_id?: number | null;
  operation_status?: number | null;
  status?: number | null;
  raised_by?: number | null;
  assigned_to?: number | null;
  product_id?: number | null;
  priority?: number | null;
  company_id?: number | null;
  company_type?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface BackendMessageItem {
  msg?: string;
  status?: boolean;
  data?: TicketRow[];
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

export const listTicketsTool: ToolDefinition<typeof schema, ListTicketsResult> = {
  name: "list_tickets",
  title: "List support tickets — every ticket the caller can access",
  description:
    "Returns every active ticket across all companies the caller can see. Each row carries: " +
    "id, title, description, category_id, operation_status (1 todo / 2 in-progress / 3 pending " +
    "/ 4 completed), status (1 active / 2 deleted), raised_by user_id, assigned_to user_id, " +
    "product_id, priority code, company context, and timestamps." +
    "\n\nUNDERSTANDING THE FLOW: The backend resolves all sibling/child companies via RabbitMQ " +
    "(`company_info_queue_by_id`) and returns tickets matching that set OR tickets explicitly " +
    "assigned to the caller. Only `status = 1` (active) tickets are returned. company_id / " +
    "company_type from session auth are auto-injected." +
    "\n\nUSE THIS TOOL TO: triage open tickets, find a ticket by title before drilling into " +
    "`get_ticket_by_id`, or count work-in-flight per category." +
    "\n\nNOTE: This is a flat list with no pagination — large tenants may return many rows. " +
    "For tickets assigned specifically to the caller use `list_my_assigned_tickets` (richer " +
    "shape with category names, status labels and progress).",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["tickets", "list"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<BackendEnvelope>(
      `${SERVICE.TICKETS}/getAllTickets`,
      {},
      ctx,
    );

    const list = pickFirst(res).data ?? [];

    const tickets: TicketSummary[] = list.map((t) => ({
      id: t.id ?? 0,
      title: t.title ?? "",
      description: t.description ?? null,
      category_id: t.category_id ?? null,
      operation_status: t.operation_status ?? null,
      status: t.status ?? null,
      raised_by: t.raised_by ?? null,
      assigned_to: t.assigned_to ?? null,
      product_id: t.product_id ?? null,
      priority: t.priority ?? null,
      company_id: t.company_id ?? null,
      company_type: t.company_type ?? null,
      created_at: t.createdAt ?? null,
      updated_at: t.updatedAt ?? null,
    }));

    return { total: tickets.length, tickets };
  },
};

toolRegistry.register(listTicketsTool);
