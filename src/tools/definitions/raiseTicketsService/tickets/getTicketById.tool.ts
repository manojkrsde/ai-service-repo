import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe("Ticket id to fetch. Use list_tickets to discover ids."),
});

interface GetTicketByIdResult {
  ticket: Record<string, unknown> | null;
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

export const getTicketByIdTool: ToolDefinition<
  typeof schema,
  GetTicketByIdResult
> = {
  name: "get_ticket_by_id",
  title: "Get one ticket — full row by id",
  description:
    "Fetches a single ticket by primary key. Returns every column on the ticket: id, " +
    "category_id, title, description, status, operation_status, raised_by, assigned_to, " +
    "product_id, priority, due_date, company context, and timestamps." +
    "\n\nUNDERSTANDING THE FLOW: Direct primary-key lookup — `findByPk(id)`. The backend does " +
    "NOT additionally check soft-delete or company scope, so a ticket from outside the " +
    "caller's tenant could surface if the id is known. Treat `null` / missing fields as the " +
    "ticket not existing." +
    "\n\nUSE THIS TOOL TO: render a ticket detail page, look up status / priority before a " +
    "comment, or feed the row into a downstream summary." +
    "\n\nNOTE: To pull the comment thread call `list_ticket_comments` with the same ticket id.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["tickets", "lookup"] },

  handler: async (input, ctx) => {
    const res = await apiPost<BackendEnvelope>(
      `${SERVICE.TICKETS}/getRaiseTicketById`,
      { id: input.id },
      ctx,
      {
        injectCompanyContext: false,
      },
    );

    return { ticket: pickFirst(res).data ?? null };
  },
};

toolRegistry.register(getTicketByIdTool);
