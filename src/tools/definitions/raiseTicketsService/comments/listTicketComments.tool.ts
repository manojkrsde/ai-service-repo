import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  t_ticket_id: z
    .number()
    .int()
    .positive()
    .describe("Ticket id whose comment thread to fetch."),
});

interface CommentRow {
  id: number;
  t_ticket_id: number | null;
  comment: string | null;
  user_id: number | null;
  status: number | null;
  attachments: unknown[] | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ListTicketCommentsResult {
  ticket_id: number;
  count: number;
  comments: CommentRow[];
}

interface RawComment {
  id?: number;
  t_ticket_id?: number | null;
  comment?: string | null;
  user_id?: number | null;
  status?: number | null;
  attachments?: unknown[] | null;
  createdAt?: string;
  updatedAt?: string;
}

interface BackendMessageItem {
  msg?: string;
  status?: boolean;
  data?: RawComment[];
  commentCount?: number;
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

export const listTicketCommentsTool: ToolDefinition<
  typeof schema,
  ListTicketCommentsResult
> = {
  name: "list_ticket_comments",
  title: "List comments on a ticket — full thread",
  description:
    "Returns every active comment on a ticket. Each row carries: id, parent t_ticket_id, " +
    "comment body, user_id (commenter), optional attachments, status flag and timestamps." +
    "\n\nUNDERSTANDING THE FLOW: Filters out soft-deleted comments (status=2). The thread is " +
    "flat (no nested replies)." +
    "\n\nUSE THIS TOOL TO: render a ticket discussion panel, summarise the latest agent reply, " +
    "or audit who responded last." +
    "\n\nNOTE: There is no MCP tool today for adding ticket comments — the backend's " +
    "`addCommentAndUpdateStatus` endpoint also mutates ticket status, which is destructive and " +
    "deliberately not exposed.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["tickets", "comments", "list"] },

  handler: async (input, ctx) => {
    const res = await apiPost<BackendEnvelope>(
      `${SERVICE.TICKETS}/getCommentsByTicketId`,
      { t_ticket_id: input.t_ticket_id },
      ctx,
      {
        injectCompanyContext: false,
      },
    );

    const first = pickFirst(res);
    const list = first.data ?? [];

    const comments: CommentRow[] = list.map((c) => ({
      id: c.id ?? 0,
      t_ticket_id: c.t_ticket_id ?? null,
      comment: c.comment ?? null,
      user_id: c.user_id ?? null,
      status: c.status ?? null,
      attachments: c.attachments ?? null,
      created_at: c.createdAt ?? null,
      updated_at: c.updatedAt ?? null,
    }));

    return {
      ticket_id: input.t_ticket_id,
      count: first.commentCount ?? comments.length,
      comments,
    };
  },
};

toolRegistry.register(listTicketCommentsTool);
