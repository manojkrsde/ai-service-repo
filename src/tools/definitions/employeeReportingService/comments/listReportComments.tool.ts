/**
 * Lists root-level comments (depth=0) on an employee report, paginated,
 * with each root comment's reply tree nested inline.
 *
 * Combines two backend calls:
 *   1. POST /comments/getByReport — root comments, paginated
 *   2. POST /comments/getReplies  — replies under each root with
 *                                   reply_count > 0 (fanned out in parallel)
 *
 * Backend Joi for both endpoints accepts `signature` + ids only, so
 * company-context injection is suppressed.
 *
 * The comment system is a 3-level threaded tree (root → reply → nested
 * reply, max depth 2) using a materialised path. Replies are returned
 * embedded on each root row as a flat list ordered by depth ASC then
 * created_at ASC; use parent_id + depth to reconstruct the sub-tree.
 */
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
      "The employee-report ID whose comment thread to fetch. Resolve from list_my_reports " +
        "or list_team_reports.",
    ),
  page: z
    .number()
    .int()
    .positive()
    .default(1)
    .describe("Page number (1-indexed)."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe("Page size for root comments, max 50."),
  include_replies: z
    .boolean()
    .default(true)
    .describe(
      "When true (default), replies are fetched in parallel and embedded under each root " +
        "comment as `replies`. Set to false when you only need root rows + reply_count " +
        "(saves a fan-out of N extra calls).",
    ),
});

interface CommentUser {
  id?: number;
  fname?: string;
  lname?: string;
  email?: string;
}

interface ReplyComment {
  id: number;
  report_id: number;
  user: CommentUser | null;
  parent_id: number | null;
  depth: number;
  comment_text: string;
  is_edited: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_reply: boolean;
  created_at: string;
  updated_at: string;
}

interface RootComment {
  id: number;
  report_id: number;
  user: CommentUser | null;
  parent_id: number | null;
  depth: number;
  comment_text: string;
  is_edited: boolean;
  reply_count: number;
  can_edit: boolean;
  can_delete: boolean;
  can_reply: boolean;
  created_at: string;
  updated_at: string;
  replies: ReplyComment[];
}

interface Pagination {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

interface ListReportCommentsResult {
  report_id: number;
  pagination: Pagination;
  returned: number;
  comments: RootComment[];
}

interface ReplyCommentRecord {
  id?: number;
  report_id?: number;
  user?: CommentUser | null;
  parent_id?: number | null;
  depth?: number;
  comment_text?: string;
  is_edited?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
  can_reply?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface RootCommentRecord {
  id?: number;
  report_id?: number;
  user?: CommentUser | null;
  parent_id?: number | null;
  depth?: number;
  comment_text?: string;
  is_edited?: boolean;
  reply_count?: number;
  can_edit?: boolean;
  can_delete?: boolean;
  can_reply?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface PaginationRecord {
  currentPage?: number;
  totalPages?: number;
  totalItems?: number;
  itemsPerPage?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

interface ListReportCommentsBody {
  comments?: RootCommentRecord[];
  pagination?: PaginationRecord;
}

interface ListReportCommentsResponse {
  msg?: string;
  data?: ListReportCommentsBody;
}

interface CommentRepliesBody {
  parent_comment_id?: number;
  replies?: ReplyCommentRecord[];
  total_replies?: number;
}

interface GetCommentRepliesResponse {
  msg?: string;
  data?: CommentRepliesBody;
}

const mapReply = (r: ReplyCommentRecord): ReplyComment => ({
  id: r.id ?? 0,
  report_id: r.report_id ?? 0,
  user: r.user ?? null,
  parent_id: r.parent_id ?? null,
  depth: r.depth ?? 1,
  comment_text: r.comment_text ?? "",
  is_edited: r.is_edited ?? false,
  can_edit: r.can_edit ?? false,
  can_delete: r.can_delete ?? false,
  can_reply: r.can_reply ?? false,
  created_at: r.created_at ?? "",
  updated_at: r.updated_at ?? "",
});

export const listReportCommentsTool: ToolDefinition<
  typeof schema,
  ListReportCommentsResult
> = {
  name: "list_report_comments",
  title:
    "List report comments — root thread on an employee report, with replies nested inline",
  description:
    "Returns the full comment discussion on a single employee report. Root-level " +
    "(depth=0) comments come back paginated newest-first, and each row carries its " +
    "reply tree inline as `replies` (depth 1 and depth 2, ordered by depth ASC then " +
    "created_at ASC). Every row — root or reply — includes id, report_id, user " +
    "(resolved {id, fname, lname, email}), comment_text, is_edited, can_edit / " +
    "can_delete / can_reply for the calling user, and timestamps. Root rows " +
    "additionally carry reply_count. " +
    "\n\nUNDERSTANDING THE FLOW: This is the EMPLOYEE-REPORT comment system — a 3-level " +
    "threaded tree (root → reply → nested reply, max depth 2) using materialised paths. " +
    "Replies at depth 2 always come back with can_reply=false because no deeper nesting " +
    "is allowed. Soft-deleted comments are excluded by the backend. Visibility is " +
    "governed by report ownership / shows_to. Different from list_todo_comments, which " +
    "is a flat thread on a TODO. " +
    "\n\nUSE THIS TOOL TO: answer 'what discussion is on this report?', 'how many " +
    "comments did my report get?', 'let me see what they said back'. One call gets the " +
    "whole conversation. " +
    "\n\nNOTE: Set include_replies=false if you only need the root rows (e.g. counts) " +
    "— this skips the per-comment fan-out. limit caps at 50 server-side. When " +
    "include_replies=true, replies are fetched in parallel after the root page loads.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["reports", "comments"] },

  handler: async (input, ctx) => {
    const rootRes = await apiPost<ListReportCommentsResponse>(
      `${SERVICE.ERS}/comments/getByReport`,
      {
        report_id: input.report_id,
        page: input.page,
        limit: input.limit,
      },
      ctx,
      { injectCompanyContext: false },
    );

    const data = rootRes.data ?? {};
    const records = data.comments ?? [];
    const pag = data.pagination ?? {};

    const replyMap = new Map<number, ReplyComment[]>();
    if (input.include_replies) {
      const fetches = records
        .filter((r) => (r.reply_count ?? 0) > 0 && r.id != null)
        .map(async (r) => {
          const id = r.id as number;
          const res = await apiPost<GetCommentRepliesResponse>(
            `${SERVICE.ERS}/comments/getReplies`,
            { comment_id: id },
            ctx,
            { injectCompanyContext: false },
          );
          replyMap.set(id, (res.data?.replies ?? []).map(mapReply));
        });
      await Promise.all(fetches);
    }

    const comments: RootComment[] = records.map((r) => {
      const id = r.id ?? 0;
      return {
        id,
        report_id: r.report_id ?? input.report_id,
        user: r.user ?? null,
        parent_id: r.parent_id ?? null,
        depth: r.depth ?? 0,
        comment_text: r.comment_text ?? "",
        is_edited: r.is_edited ?? false,
        reply_count: r.reply_count ?? 0,
        can_edit: r.can_edit ?? false,
        can_delete: r.can_delete ?? false,
        can_reply: r.can_reply ?? false,
        created_at: r.created_at ?? "",
        updated_at: r.updated_at ?? "",
        replies: replyMap.get(id) ?? [],
      };
    });

    const pagination: Pagination = {
      current_page: pag.currentPage ?? input.page,
      total_pages: pag.totalPages ?? 1,
      total_items: pag.totalItems ?? comments.length,
      items_per_page: pag.itemsPerPage ?? input.limit,
      has_next_page: pag.hasNextPage ?? false,
      has_prev_page: pag.hasPrevPage ?? false,
    };

    return {
      report_id: input.report_id,
      pagination,
      returned: comments.length,
      comments,
    };
  },
};

toolRegistry.register(listReportCommentsTool);
