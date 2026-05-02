import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  report_id: z
    .number()
    .int()
    .positive()
    .describe(
      "Employee-report id to comment on (t_user_reports.id). Caller must have access to the report.",
    ),
  comment_text: z
    .string()
    .trim()
    .min(1)
    .describe("Comment body text (required, non-empty)."),
  parent_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional()
    .describe(
      "Optional parent comment id for nested replies. Omit / null for a root comment. Backend caps reply depth at 3 levels.",
    ),
});

interface AddReportCommentResult {
  success: boolean;
  report_id: number;
  message: string;
}

interface BackendMessageItem {
  msg?: string;
  status?: boolean;
}

interface BackendEnvelope {
  message?: BackendMessageItem[] | BackendMessageItem | string;
}

function pickFirst(env: BackendEnvelope | undefined): BackendMessageItem {
  const m = env?.message;
  if (Array.isArray(m)) return m[0] ?? {};
  if (m && typeof m === "object") return m as BackendMessageItem;
  if (typeof m === "string") return { msg: m };
  return {};
}

export const addReportCommentTool: ToolDefinition<
  typeof schema,
  AddReportCommentResult
> = {
  name: "add_report_comment",
  title: "Comment on an employee report — append-only, threaded",
  description:
    "Appends a new comment to an employee-report thread. Required: `report_id`, " +
    "`comment_text`. Optional `parent_id` makes the comment a nested reply (max depth 3)." +
    "\n\nUNDERSTANDING THE FLOW: The backend re-resolves the caller's company via RabbitMQ, " +
    "validates that the source report exists and belongs to the caller's tenant, computes the " +
    "thread path / depth / root_id, writes the comment row, and emails recipients (report " +
    "owner + everyone in `shows_to`). company_id / company_type are auto-injected." +
    "\n\nUSE THIS TOOL TO: leave feedback on a teammate's report, ask a clarifying question, " +
    "or thread a reply onto an existing comment via `parent_id`." +
    "\n\nNOTE: Editing/deleting comments are destructive operations and not exposed via MCP. " +
    "To list comments on a report use `list_report_comments`.",
  inputSchema: schema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  meta: { version: "1.0.0", tags: ["action", "ers", "comments"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      report_id: input.report_id,
      comment_text: input.comment_text,
    };
    if (input.parent_id !== undefined) body["parent_id"] = input.parent_id;

    const res = await apiPost<BackendEnvelope>(
      `${SERVICE.ERS}/comments/create`,
      body,
      ctx,
      {
        injectCompanyContext: false,
      },
    );

    const first = pickFirst(res);

    return {
      success: first.status !== false,
      report_id: input.report_id,
      message: first.msg ?? "Comment added successfully",
    };
  },
};

toolRegistry.register(addReportCommentTool);
