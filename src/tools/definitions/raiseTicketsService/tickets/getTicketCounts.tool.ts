import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface CategoryCount {
  category_id: number;
  count: number;
}

interface GetTicketCountsResult {
  todo: number;
  in_progress: number;
  pending: number;
  completed: number;
  by_category: CategoryCount[];
  message: string;
}

interface BackendCountsData {
  operationStatus_1?: number;
  operationStatus_2?: number;
  operationStatus_3?: number;
  operationStatus_4?: number;
  categoryDetails?: CategoryCount[];
}

interface BackendMessageItem {
  msg?: string;
  status?: boolean;
  data?: BackendCountsData;
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

export const getTicketCountsTool: ToolDefinition<
  typeof schema,
  GetTicketCountsResult
> = {
  name: "get_ticket_counts",
  title: "Counts of tickets by operation status and category",
  description:
    "Aggregate ticket counts grouped by `operation_status` (1=todo, 2=in-progress, 3=pending, " +
    "4=completed) plus a per-category breakdown (`by_category`) of active categories." +
    "\n\nUNDERSTANDING THE FLOW: Backend resolves visible companies via RabbitMQ, then runs two " +
    "GROUP BY queries on `t_tickets` filtered to active categories (m_tickets_category.status=1). " +
    "If the caller's user_id is bound to a numeric requesting-user id, the aggregation is also " +
    "filtered to `raised_by = caller`. company_id / company_type are auto-injected." +
    "\n\nUSE THIS TOOL TO: render a status-pill summary at the top of a dashboard, see how many " +
    "tickets are pending vs done, or drive a per-category bar chart." +
    "\n\nNOTE: Returns zeros if no active categories exist for the company. For per-user " +
    "metrics on tickets specifically assigned to the caller use `get_ticket_statistics`.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["tickets", "stats"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<BackendEnvelope>(
      `${SERVICE.TICKETS}/getTicketCounts`,
      {},
      ctx,
    );

    const first = pickFirst(res);
    const data = first.data ?? {};

    return {
      todo: data.operationStatus_1 ?? 0,
      in_progress: data.operationStatus_2 ?? 0,
      pending: data.operationStatus_3 ?? 0,
      completed: data.operationStatus_4 ?? 0,
      by_category: data.categoryDetails ?? [],
      message: first.msg ?? "Counts retrieved successfully",
    };
  },
};

toolRegistry.register(getTicketCountsTool);
