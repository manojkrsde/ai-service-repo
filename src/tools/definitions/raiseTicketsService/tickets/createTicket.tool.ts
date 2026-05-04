import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  category_id: z
    .number()
    .int()
    .positive()
    .describe(
      "Ticket category id (m_tickets_category.id). Use list_ticket_categories to discover ids.",
    ),
  title: z
    .string()
    .trim()
    .min(1)
    .describe("Ticket title (required, non-empty)."),
  description: z
    .string()
    .trim()
    .describe("Ticket body / description (required)."), // ← now required
  priority: z
    .number()
    .int()
    .describe("Priority (required). Numeric: 1=Low, 2=High, 3=Medium."), // ← now required
  status: z.number().int().describe("Status (required). 1=Active, 2=Deleted."), // ← now required
  operation_status: z
    .number()
    .int()
    .optional()
    .describe(
      "Optional operation status. 1=Todo, 2=Inprogress, 3=?, 4=?. " +
        "Auto-computed by backend if omitted: 2 when assigned_to is set, 1 otherwise.",
    ), // ← new field
  raised_by: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Optional explicit raiser user_id. Defaults to calling user when product_id is provided.",
    ),
  assigned_to: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Optional initial assignee user_id. When set the backend stamps operation_status=2 (in-progress); otherwise 1 (todo).",
    ),
  product_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Optional product id this ticket relates to."),
});

interface CreateTicketResult {
  success: boolean;
  ticket: Record<string, unknown> | null;
  message: string;
}

interface BackendMessageItem {
  msg?: string;
  status?: boolean;
  data?: Record<string, unknown> | null;
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

export const createTicketTool: ToolDefinition<
  typeof schema,
  CreateTicketResult
> = {
  name: "create_ticket",
  title: "Raise a new support ticket",
  description:
    "Creates a new ticket in the caller's company. Required: `category_id`, `title`, " +
    "`description`, `priority` (1=Low,2=High,3=Medium), `status` (1=Active,2=Deleted). Optional: " +
    "`operation_status` (1=Todo,2=Inprogress — auto-computed if omitted), `raised_by`, " +
    "`assigned_to`, `product_id`. The backend auto-stamps `operation_status` based on " +
    "`assigned_to` (with assignee = 2 / in-progress, without = 1 / todo)." +
    "\n\nUNDERSTANDING THE FLOW: Append-only — never edits an existing ticket. company_id / " +
    "company_type are auto-injected from session auth. The new row is echoed back in the " +
    "response message." +
    "\n\nUSE THIS TOOL TO: open a ticket on behalf of the caller, escalate a chat issue into the " +
    "tracking system, or capture a follow-up against an existing product." +
    "\n\nNOTE: Use `list_ticket_categories` first to discover valid `category_id`s. To inspect " +
    "the new ticket call `get_ticket_by_id` with the id from the response.",
  inputSchema: schema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  meta: { version: "1.0.0", tags: ["action", "tickets", "create"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      category_id: input.category_id,
      title: input.title,
    };
    if (input.description !== undefined)
      body["description"] = input.description;
    if (input.priority !== undefined) body["priority"] = input.priority;
    if (input.raised_by !== undefined) body["raised_by"] = input.raised_by;
    if (input.assigned_to !== undefined)
      body["assigned_to"] = input.assigned_to;
    if (input.product_id !== undefined) body["product_id"] = input.product_id;
    if (input.status !== undefined) body["status"] = input.status;
    if (input.operation_status !== undefined)
      body["operation_status"] = input.operation_status;

    const res = await apiPost<BackendEnvelope>(
      `${SERVICE.TICKETS}/addRaiseTicket`,
      body,
      ctx,
    );

    const first = pickFirst(res);

    return {
      success: first.status !== false,
      ticket: first.data ?? null,
      message: first.msg ?? "Ticket created successfully",
    };
  },
};

toolRegistry.register(createTicketTool);
