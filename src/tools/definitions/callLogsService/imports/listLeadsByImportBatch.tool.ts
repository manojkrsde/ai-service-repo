import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  file_name: z
    .string()
    .trim()
    .min(1)
    .describe(
      "The stored file_name of the import batch. Use list_bulk_import_batches to discover values.",
    ),
});

interface CallLeadRow {
  id: number;
  name: string | null;
  mobile_no: string | null;
  status: string | null;
  assigned_to: number | null;
  file_name: string | null;
  company_id: number | null;
  company_type: string | null;
  created_at: string | null;
}

interface ListLeadsByImportBatchResult {
  file_name: string;
  total: number;
  leads: CallLeadRow[];
}

interface RawCallLead {
  id?: number;
  name?: string | null;
  mobile_no?: string | null;
  status?: string | null;
  assigned_to?: number | null;
  file_name?: string | null;
  company_id?: number | null;
  company_type?: string | null;
  createdAt?: string;
  created_at?: string;
}

interface ListLeadsResponse {
  data?: RawCallLead[];
}

export const listLeadsByImportBatchTool: ToolDefinition<
  typeof schema,
  ListLeadsByImportBatchResult
> = {
  name: "list_leads_by_import_batch",
  title: "List call leads from a single bulk-import batch",
  description:
    "Returns every call lead row from one bulk-import batch identified by `file_name`. Each " +
    "row carries: id, name, mobile_no, status (assigned/unassigned/etc.), assigned_to user, " +
    "file_name (echoed), company context, and creation timestamp." +
    "\n\nUNDERSTANDING THE FLOW: Backend filters `t_leads_calls_data` by exact `file_name` " +
    "and the caller's company. company_id / company_type are auto-injected." +
    "\n\nUSE THIS TOOL TO: drill into a batch from `list_bulk_import_batches`, audit which " +
    "leads in a file are still unassigned, or pre-populate a dialer queue with one batch." +
    "\n\nNOTE: `file_name` must match exactly (it includes the company/timestamp prefix). For " +
    "a fresh-import preview use `list_unassigned_call_leads`.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calls", "imports", "leads", "list"] },

  handler: async (input, ctx) => {
    const res = await apiPost<ListLeadsResponse>(
      `${SERVICE.CALL_LOGS}/getLeadsByFileName`,
      { file_name: input.file_name },
      ctx,
      {
        injectCompanyContext: true,
        companyContextKeyFormat: "camel_case",
      },
    );

    const list = res?.data ?? [];

    const leads: CallLeadRow[] = list.map((l) => ({
      id: l.id ?? 0,
      name: l.name ?? null,
      mobile_no: l.mobile_no ?? null,
      status: l.status ?? null,
      assigned_to: l.assigned_to ?? null,
      file_name: l.file_name ?? null,
      company_id: l.company_id ?? null,
      company_type: l.company_type ?? null,
      created_at: l.createdAt ?? l.created_at ?? null,
    }));

    return { file_name: input.file_name, total: leads.length, leads };
  },
};

toolRegistry.register(listLeadsByImportBatchTool);
