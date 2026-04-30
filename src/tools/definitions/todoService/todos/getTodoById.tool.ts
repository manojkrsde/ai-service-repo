/**
 * Returns a single todo by ID **with its full comment thread**.
 *
 * Internally fires two requests in parallel:
 *   POST /todoById        — Joi: signature, id (number, required)
 *   POST /commentByTodoId — Joi: signature, todo_id (number, required)
 *
 * Both suppress company-context injection (neither endpoint accepts it).
 *
 * NOTE on scoping: /todoById queries by `id` + `status: 1` only — it does
 * NOT enforce reporter/assignee/team_lead ownership. Any authenticated user
 * with todoManagement Read permission can fetch any todo by ID.
 * /commentByTodoId requires the `taskManagement` Read permission (different
 * key from `todoManagement`). If the caller lacks it, comments will be an
 * empty array and a warning flag is set rather than hard-failing the whole
 * call.
 *
 * Comments are flat — no replies, no nesting.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  id: z
    .number()
    .int()
    .positive()
    .describe(
      "Todo ID to fetch. Use list_todos to discover IDs visible to the caller.",
    ),
});

interface AssignedMember {
  id?: string;
  uid?: string;
  name?: string;
  email?: string;
  mobile_no?: string;
  img?: string;
}

interface Reporter {
  id?: string | number;
  uid?: string;
  name?: string;
  email?: string;
  mobile_no?: string;
  img?: string;
}

interface TodoDetail {
  id: number;
  title: string;
  description: string | null;
  priority: number | null;
  priority_label: string;
  stage: number | null;
  stage_label: string;
  status: number;
  due_date: string | null;
  recurring_date: string | null;
  recurring_type: string | null;
  recurring_day: string | null;
  recurring_month: string | null;
  recurring_quarter: string | null;
  tags: string[];
  attachments: unknown[];
  reporter: Reporter | null;
  assigned_members: AssignedMember[];
  team_leads: AssignedMember[];
  is_read: boolean;
  is_active: boolean;
  company_id: number;
  company_type: string;
  created_at: string;
  updated_at: string;
}

interface TodoRecord {
  id?: number;
  title?: string;
  description?: string | null;
  priority?: number | null;
  stage?: number | null;
  status?: number;
  due_date?: string | null;
  recurring_date?: string | null;
  recurring_type?: string | null;
  recurring_day?: string | null;
  recurring_month?: string | null;
  recurring_quarter?: string | null;
  tags?: string[];
  attachments?: unknown[];
  reporter?: Reporter | null;
  assigned_members?: AssignedMember[];
  team_leads?: AssignedMember[];
  isRead?: boolean;
  isActive?: boolean;
  company_id?: number;
  company_type?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface GetTodoByIdResponse {
  msg?: string;
  data?: { data?: TodoRecord };
}

interface CommentItem {
  id: number;
  todo_id: number;
  user_id: number | null;
  comment: string;
  attachments: unknown[];
  reporter: Reporter | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CommentRecord {
  id?: number;
  todo_id?: number;
  user_id?: number | null;
  comment?: string;
  attachments?: unknown[];
  reporter?: Reporter | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ListTodoCommentsResponse {
  msg?: string;
  data?: { data?: CommentRecord[] };
}

interface GetTodoByIdResult {
  todo: TodoDetail | null;
  comments: CommentItem[];
  comments_total: number;
  comments_warning: string | null; // set if taskManagement permission was missing
}

const PRIORITY_LABELS: Record<number, string> = {
  0: "High",
  1: "Medium",
  2: "Low",
};

const STAGE_LABELS: Record<number, string> = {
  0: "To Do",
  1: "In Progress",
  2: "On Hold",
  3: "Completed",
};

export const getTodoByIdTool: ToolDefinition<typeof schema, GetTodoByIdResult> =
  {
    name: "get_todo_by_id",
    title: "Get todo by ID — full task detail plus its complete comment thread",
    description:
      "Returns the full record for a single todo **and** its entire comment thread in one " +
      "call, so you never need a separate round-trip just to read the discussion. " +
      "\n\nTODO FIELDS: id, title, description, priority (0=High/1=Medium/2=Low) + " +
      "priority_label, stage (0=To Do/1=In Progress/2=On Hold/3=Completed) + stage_label, " +
      "due_date, recurring schedule (recurring_date / recurring_type / recurring_day / " +
      "recurring_month / recurring_quarter), tags, attachments, reporter, assigned_members, " +
      "team_leads, is_read, is_active, company_id, company_type, and timestamps. " +
      "Returns `todo: null` if the ID is unknown or the todo has been soft-deleted " +
      "(status=2). " +
      "\n\nCOMMENT FIELDS: Each comment includes id, todo_id, comment body, attachments, " +
      "reporter (author — name/email/uid), is_active, and timestamps. Comments are sorted " +
      "newest-first and are FLAT — no replies, no nesting. (Threaded replies on employee " +
      "reports live in a completely separate service; use list_report_comments + " +
      "get_comment_replies for those.) Soft-deleted comments are excluded by the backend. " +
      "\n\nUNDERSTANDING THE FLOW: This is the primary drilldown tool — call list_todos " +
      "first to enumerate visible IDs, then call this to get everything about one task in " +
      "a single shot. Both the todo fetch and the comment fetch run in parallel internally. " +
      "If the caller lacks `taskManagement` Read permission the todo detail will still be " +
      "returned but `comments` will be `[]` and `comments_warning` will explain why. " +
      "\n\nUSE THIS TOOL TO: drill into a task ('show me todo 42 and all its comments'), " +
      "answer 'who is assigned and what has been discussed?', summarise recent activity on " +
      "a specific task, or build a full context payload before updating/commenting. " +
      "\n\nNOTE: The todo endpoint does NOT enforce row-level ownership — any user with " +
      "`todoManagement` Read permission can fetch any ID. Multi-tenant / company-id scoping " +
      "is NOT applied by the backend here. Treat results as 'accessible' rather than " +
      "'privately owned'.",
    inputSchema: schema,
    annotations: { readOnlyHint: true, idempotentHint: true },
    meta: { version: "2.0.0", tags: ["todos", "detail", "comments"] },

    handler: async (input, ctx) => {
      const [todoRes, commentsRes] = await Promise.allSettled([
        apiPost<GetTodoByIdResponse>(
          `${SERVICE.TODO}/todoById`,
          { id: input.id },
          ctx,
          { injectCompanyContext: false },
        ),
        apiPost<ListTodoCommentsResponse>(
          `${SERVICE.TODO}/commentByTodoId`,
          { todo_id: input.id },
          ctx,
          { injectCompanyContext: false },
        ),
      ]);

      // Todo
      let todo: TodoDetail | null = null;
      if (todoRes.status === "fulfilled") {
        const r = todoRes.value.data?.data;
        if (r) {
          todo = {
            id: r.id ?? input.id,
            title: r.title ?? "",
            description: r.description ?? null,
            priority: r.priority ?? null,
            priority_label:
              r.priority !== null && r.priority !== undefined
                ? (PRIORITY_LABELS[r.priority] ?? "Unknown")
                : "Unknown",
            stage: r.stage ?? null,
            stage_label:
              r.stage !== null && r.stage !== undefined
                ? (STAGE_LABELS[r.stage] ?? "Unknown")
                : "Unknown",
            status: r.status ?? 1,
            due_date: r.due_date ?? null,
            recurring_date: r.recurring_date ?? null,
            recurring_type: r.recurring_type ?? null,
            recurring_day: r.recurring_day ?? null,
            recurring_month: r.recurring_month ?? null,
            recurring_quarter: r.recurring_quarter ?? null,
            tags: r.tags ?? [],
            attachments: r.attachments ?? [],
            reporter: r.reporter ?? null,
            assigned_members: r.assigned_members ?? [],
            team_leads: r.team_leads ?? [],
            is_read: r.isRead ?? false,
            is_active: r.isActive ?? true,
            company_id: r.company_id ?? 0,
            company_type: r.company_type ?? "",
            created_at: r.createdAt ?? "",
            updated_at: r.updatedAt ?? "",
          };
        }
      }

      // Comments
      let comments: CommentItem[] = [];
      let comments_warning: string | null = null;

      if (commentsRes.status === "fulfilled") {
        const records = commentsRes.value.data?.data ?? [];
        comments = records.map((r) => ({
          id: r.id ?? 0,
          todo_id: r.todo_id ?? input.id,
          user_id: r.user_id ?? null,
          comment: r.comment ?? "",
          attachments: r.attachments ?? [],
          reporter: r.reporter ?? null,
          is_active: r.isActive ?? true,
          created_at: r.createdAt ?? "",
          updated_at: r.updatedAt ?? "",
        }));
      } else {
        comments_warning =
          "Comments could not be loaded — the calling user may lack `taskManagement` " +
          "Read permission, or the comment service is unavailable.";
      }

      return {
        todo,
        comments,
        comments_total: comments.length,
        comments_warning,
      };
    },
  };

toolRegistry.register(getTodoByIdTool);
