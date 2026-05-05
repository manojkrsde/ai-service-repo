import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const teamMember = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  EmpId: z.string().optional(),
  mobile_no: z.string().optional(),
  img: z.string().optional(),
});

const schema = z.object({
  title: z.string().trim().min(1).describe("Todo title (required, non-empty)."),
  description: z
    .string()
    .trim()
    .optional()
    .describe("Optional todo body / description."),
  due_date: z
    .string()
    .optional()
    .describe("Optional due date as ISO string or 'YYYY-MM-DD'."),
  priority: z
    .number()
    .int()
    .describe("Priority (required). 0=High, 1=Medium, 2=Low."),
  stage: z
    .number()
    .int()
    .describe(
      "Stage (required). 0=Pending, 1=Inprogress, 2=Onhold, 3=Completed.",
    ),
  status: z
    .number()
    .int()
    .describe("Status (required). 0=Inactive, 1=Active, 2=Deleted."),
  assigned_members: z
    .array(teamMember)
    .min(1)
    .describe(
      "Required list of users assigned to the todo (min 1). Each receives an email + WhatsApp notification.",
    ),
  team_leads: z
    .array(teamMember)
    .optional()
    .describe(
      "Optional list of follower / lead users. Each receives a follow-up notification.",
    ),
  recurring_type: z
    .string()
    .optional()
    .describe(
      "Optional recurrence frequency type. Must be exactly: 'Weekly', 'Monthly', or 'Quarterly'.",
    ),
  recurring_day: z
    .string()
    .optional()
    .describe(
      "Day specifier for the recurrence. " +
        "Weekly: day-of-week as string ('0'=Sunday,'1'=Monday,...,'6'=Saturday). " +
        "Monthly: day-of-month as string ('1'–'30'). " +
        "Quarterly: day-of-month within the selected quarter month as string ('1'–'30').",
    ),
  recurring_month: z
    .string()
    .optional()
    .describe(
      "Month number within the selected quarter (e.g. '1'=Jan,'2'=Feb ... '12'=Dec). Only used when recurring_type='Quarterly'.",
    ),
  recurring_quarter: z
    .string()
    .optional()
    .describe(
      "Quarter specifier ('1'=Jan-Mar, '2'=Apr-Jun, '3'=Jul-Sep, '4'=Oct-Dec). Only used when recurring_type='Quarterly'.",
    ),
  recurring_date: z
    .string()
    .optional()
    .describe(
      "Auto-calculated next trigger date (ISO 'YYYY-MM-DD'). " +
        "Weekly: next occurrence of recurring_day. " +
        "Monthly: next occurrence of recurring_day in current/next month. " +
        "Quarterly: computed from recurring_quarter + recurring_month + recurring_day.",
    ),
});

interface CreateTodoResult {
  success: boolean;
  todo: Record<string, unknown> | null;
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

export const createTodoTool: ToolDefinition<typeof schema, CreateTodoResult> = {
  name: "create_todo",
  title: "Create a todo / personal task",
  description:
    "Creates a new todo in the caller's company. Required: `title`, `assigned_members[]`, `priority`, `stage`, `status`. " +
    "Optional: `description`, `due_date`, `priority` (0=High,1=Medium,2=Low), " +
    "`stage` (0=Pending,1=Inprogress,2=Onhold,3=Completed), `status` (0=Inactive,1=Active,2=Deleted), " +
    "`team_leads[]`, `recurring_date`, `recurring_type` (Weekly/Monthly/Quarterly), " +
    "`recurring_day`, `recurring_month`, `recurring_quarter`. " +
    "The backend stamps the calling user as reporter and triggers email " +
    "+ WhatsApp notifications to every assignee and team lead." +
    "\n\nUNDERSTANDING THE FLOW: Append-only — never edits an existing todo. company_id / " +
    "company_type are auto-injected from session auth. Notifications fire asynchronously via " +
    "RabbitMQ; the response returns as soon as the row is written (do not assume notifications " +
    "have arrived)." +
    "\n\nUSE THIS TOOL TO: capture a quick personal task, queue work for a teammate, or set " +
    "up a recurring reminder." +
    "\n\nNOTE: For comments on the todo use `add_todo_comment` after creation. Editing/deleting " +
    "are destructive and not exposed via MCP today.",
  inputSchema: schema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  meta: { version: "1.0.0", tags: ["action", "todo", "create"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = { title: input.title };
    if (input.description !== undefined)
      body["description"] = input.description;
    if (input.due_date !== undefined) body["due_date"] = input.due_date;
    if (input.priority !== undefined) body["priority"] = input.priority;
    if (input.stage !== undefined) body["stage"] = input.stage;
    if (input.assigned_members !== undefined)
      body["assigned_members"] = input.assigned_members;
    if (input.team_leads !== undefined) body["team_leads"] = input.team_leads;
    if (input.recurring_date !== undefined)
      body["recurring_date"] = input.recurring_date;
    if (input.recurring_type !== undefined)
      body["recurring_type"] = input.recurring_type;
    if (input.recurring_month !== undefined)
      body["recurring_month"] = input.recurring_month;
    if (input.recurring_quarter !== undefined)
      body["recurring_quarter"] = input.recurring_quarter;
    if (input.recurring_day !== undefined)
      body["recurring_day"] = input.recurring_day;
    if (input.status !== undefined) body["status"] = input.status;

    const res = await apiPost<BackendEnvelope>(
      `${SERVICE.TODO}/addTodos`,
      body,
      ctx,
    );

    const first = pickFirst(res);

    return {
      success: first.status !== false,
      todo: first.data ?? null,
      message: first.msg ?? "Todo created successfully",
    };
  },
};

toolRegistry.register(createTodoTool);
