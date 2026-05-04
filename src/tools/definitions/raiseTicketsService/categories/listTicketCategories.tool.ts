import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface TicketCategorySummary {
  id: number;
  category: string;
  status: string;
  company_id: number | null;
  company_type: string | null;
  company: string;
}

interface ListTicketCategoriesResult {
  total: number;
  categories: TicketCategorySummary[];
}

interface RawCategory {
  key?: number;
  Category?: string;
  Company?: string;
  CompanyType?: string;
  CompanyId?: number;
  Status?: string;
}

interface CategoriesResponse {
  data?: { data?: RawCategory[] };
}

export const listTicketCategoriesTool: ToolDefinition<
  typeof schema,
  ListTicketCategoriesResult
> = {
  name: "list_ticket_categories",
  title: "List ticket categories — taxonomy used to classify tickets",
  description:
    "Returns every ticket category visible to the caller's company set, with status and " +
    "resolved company name. Each entry: `id`, `category` (display name), `status` " +
    "(Active|Inactive), `company_id`, `company_type`, `company` (resolved name)." +
    "\n\nUNDERSTANDING THE FLOW: Backend resolves visible companies via RabbitMQ and joins " +
    "categories from `m_tickets_category`, excluding soft-deleted ones (status != 2). company " +
    "names are looked up in-memory from the RabbitMQ payload." +
    "\n\nUSE THIS TOOL TO: populate a category dropdown before calling `create_ticket`, audit " +
    "categories per child company, or check if a category is currently active." +
    "\n\nNOTE: Returned `id` is the value to pass as `category_id` to `create_ticket`.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["tickets", "categories", "list"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<CategoriesResponse>(
      `${SERVICE.TICKETS}/getAllTicketCategories`,
      {},
      ctx,
    );

    const list = res?.data?.data ?? [];

    const categories: TicketCategorySummary[] = list.map((c) => ({
      id: c.key ?? 0,
      category: c.Category ?? "",
      status: c.Status ?? "Inactive",
      company_id: c.CompanyId ?? null,
      company_type: c.CompanyType ?? null,
      company: c.Company ?? "Unknown",
    }));

    return { total: categories.length, categories };
  },
};

toolRegistry.register(listTicketCategoriesTool);
