/**
 * Lists every todo visible to the calling user (single-tenant + parent /
 * child companies merged).
 *
 * Wraps POST /allTodos. Backend Joi:
 *   signature, company_type (required), company_id (required).
 * Default snake-case company-context injection works.
 *
 * Backend behaviour: looks up all related companies (parent/child) via
 * RabbitMQ `company_info_queue` and OR-matches on every (company_id,
 * company_type) pair, so a parent admin sees subsidiaries too. Non-admin
 * callers (`req.id` set; `req.uid` populated) are additionally restricted
 * to todos where reporter.id == req.id OR assigned_members[].id == uid OR
 * team_leads[].id == uid. Soft-deleted todos (`status: 2`) are excluded.
 * No pagination — returns the full set ordered by createdAt DESC.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

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

interface TodoItem {
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
  tags: string[];
  reporter: Reporter | null;
  assigned_members: AssignedMember[];
  team_leads: AssignedMember[];
  is_read: boolean;
  is_active: boolean;
  company_id: number;
  company_type: string;
  company_name: string | null;
  created_at: string;
  updated_at: string;
}

interface ListTodosResult {
  returned: number;
  todos: TodoItem[];
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
  tags?: string[];
  reporter?: Reporter | null;
  assigned_members?: AssignedMember[];
  team_leads?: AssignedMember[];
  isRead?: boolean;
  isActive?: boolean;
  company_id?: number;
  company_type?: string;
  company_name?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ListTodosResponse {
  msg?: string;
  data?: { data?: TodoRecord[] };
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

export const listTodosTool: ToolDefinition<typeof schema, ListTodosResult> = {
  name: "list_todos",
  title:
    "List todos — every task visible to the calling user across related companies",
  description:
    "Returns every todo the calling user can see, sorted by createdAt DESC. Each todo includes " +
    "id, title, description, priority (with label High/Medium/Low), stage (with label To Do/" +
    "In Progress/On Hold/Completed), due_date, tags, reporter, assigned_members, team_leads, " +
    "company_id/type/name, and timestamps. " +
    "\n\nUNDERSTANDING THE FLOW: Tenant scoping is automatic — the backend resolves all " +
    "related companies (parent + children) via `company_info_queue` and merges them, so a " +
    "parent-company admin sees subsidiary todos too. Non-admin callers see only todos where " +
    "they are reporter, assignee, or team_lead. Soft-deleted todos (status=2) are excluded. " +
    "There is NO pagination — the full set is returned. " +
    "\n\nUSE THIS TOOL TO: answer 'what tasks are on my plate?', 'show me everything in " +
    "progress this week', 'who has the most todos?'. Use the ids from this result to call " +
    "get_todo_by_id for a full drilldown on any specific task — that tool returns the complete " +
    "todo detail AND its entire comment thread in a single call. " +
    "\n\nNOTE: The result count is unbounded — for very active companies prefer filtering by " +
    "stage/priority on the consumer side. priority and stage may both be null on legacy rows.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["todos", "list"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<ListTodosResponse>(
      `${SERVICE.TODO}/allTodos`,
      {},
      ctx,
    );

    const records = res.data?.data ?? [];
    const todos: TodoItem[] = records.map((r) => ({
      id: r.id ?? 0,
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
      tags: r.tags ?? [],
      reporter: r.reporter ?? null,
      assigned_members: r.assigned_members ?? [],
      team_leads: r.team_leads ?? [],
      is_read: r.isRead ?? false,
      is_active: r.isActive ?? true,
      company_id: r.company_id ?? 0,
      company_type: r.company_type ?? "",
      company_name: r.company_name ?? null,
      created_at: r.createdAt ?? "",
      updated_at: r.updatedAt ?? "",
    }));

    return { returned: todos.length, todos };
  },
};

toolRegistry.register(listTodosTool);
