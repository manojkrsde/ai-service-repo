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
      "Numeric DB user ID of the commenter (required). Maps to reporter_id from session — use the id field from the reporter object on the todo.",
    ),
  todo_id: z
    .number()
    .int()
    .positive()
    .describe("Todo id to comment on (required)."),
  comment: z
    .string()
    .trim()
    .min(1)
    .describe("Comment body text (required, non-empty)."),
  attachments: z
    .array(z.unknown())
    .optional()
    .describe(
      "Optional array of attachment objects (e.g. uploaded file metadata).",
    ),
});

interface AddTodoCommentResult {
  success: boolean;
  todo_id: number;
  comment: Record<string, unknown> | null;
  message: string;
}

interface BackendMessageItem {
  msg?: string;
  status?: boolean;
  comment?: Record<string, unknown> | null;
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

export const addTodoCommentTool: ToolDefinition<
  typeof schema,
  AddTodoCommentResult
> = {
  name: "add_todo_comment",
  title: "Add a comment on a todo — append-only",
  description:
    "Appends a new comment to a todo. Required: `todo_id`, `comment`. Optional: `attachments`. " +
    "Reporter is auto-stamped from session auth. The backend fetches the todo and triggers " +
    "WhatsApp notifications to every assigned member and team lead." +
    "\n\nUNDERSTANDING THE FLOW: Append-only — never edits an existing comment. company_id / " +
    "company_type are auto-injected. Notifications fire asynchronously via RabbitMQ." +
    "\n\nUSE THIS TOOL TO: drop a status update on a todo, paste a meeting decision, or notify " +
    "the team a blocker has been resolved." +
    "\n\nNOTE: For the existing thread on the todo there is no read tool today — pull " +
    "`get_todo_by_id` (which includes comment summary) instead.",
  inputSchema: schema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  meta: { version: "1.0.0", tags: ["action", "todo", "comments"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      user_id: input.user_id,
      todo_id: input.todo_id,
      comment: input.comment,
    };
    if (input.attachments !== undefined)
      body["attachments"] = input.attachments;

    const res = await apiPost<BackendEnvelope>(
      `${SERVICE.TODO}/addComments`,
      body,
      ctx,
    );

    const first = pickFirst(res);

    return {
      success: first.status !== false,
      todo_id: input.todo_id,
      comment: first.comment ?? null,
      message: first.msg ?? "Comment added successfully",
    };
  },
};

toolRegistry.register(addTodoCommentTool);
