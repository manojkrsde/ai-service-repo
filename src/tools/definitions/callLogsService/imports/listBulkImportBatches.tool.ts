import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  startDate: z
    .string()
    .optional()
    .describe(
      "Optional ISO start date (YYYY-MM-DD) — only batches uploaded on or after this date.",
    ),
  endDate: z
    .string()
    .optional()
    .describe(
      "Optional ISO end date (YYYY-MM-DD) — only batches uploaded on or before this date.",
    ),
});

interface BulkImportBatch {
  file_name: string;
  original_file_name: string;
  company_id: number | null;
  timestamp: number | null;
  first_uploaded: string | null;
  last_uploaded: string | null;
  assigned_leads: number;
  unassigned_leads: number;
  total_leads: number;
  has_assigned_leads: boolean;
  assignment_status: string;
}

interface ListBulkImportBatchesResult {
  total: number;
  batches: BulkImportBatch[];
}

interface RawBatch {
  file_name?: string;
  original_file_name?: string;
  company_id?: number | null;
  timestamp?: number | null;
  first_uploaded?: string | null;
  last_uploaded?: string | null;
  assigned_leads?: number;
  unassigned_leads?: number;
  total_leads?: number;
  has_assigned_leads?: boolean;
  assignment_status?: string;
}

interface ListBulkImportResponse {
  data?: RawBatch[];
}

export const listBulkImportBatchesTool: ToolDefinition<
  typeof schema,
  ListBulkImportBatchesResult
> = {
  name: "list_bulk_import_batches",
  title: "List bulk-imported call lead batches — file uploads",
  description:
    "Returns every bulk import batch (CSV file upload) of call leads for the caller's company. " +
    "Each batch carries: stored file_name, original_file_name (parsed from convention), " +
    "first_uploaded / last_uploaded timestamps, assigned_leads / unassigned_leads / " +
    "total_leads counts, has_assigned_leads flag, and assignment_status (fully_assigned / " +
    "partially_assigned / unassigned). Optional date-range filter via `startDate` / `endDate`." +
    "\n\nUNDERSTANDING THE FLOW: Backend groups `t_leads_calls_data` by file_name and runs " +
    "a per-batch count query for assigned vs unassigned leads. company_id / company_type are " +
    "auto-injected (mapped to companyId / companyType by the route)." +
    "\n\nUSE THIS TOOL TO: enumerate prior imports, find the file_name to feed into " +
    "`list_leads_by_import_batch`, or audit which batches still have unassigned leads." +
    "\n\nNOTE: file_name follows the convention `<companyId>_<timestamp>_<userId>_<original>`. " +
    "The original_file_name field strips the prefix.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["calls", "imports", "list"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {};
    if (input.startDate !== undefined) body["startDate"] = input.startDate;
    if (input.endDate !== undefined) body["endDate"] = input.endDate;

    const res = await apiPost<ListBulkImportResponse>(
      `${SERVICE.CALL_LOGS}/getUploadedFileNames`,
      body,
      ctx,
      {
        injectCompanyContext: true,
        companyContextKeyFormat: "camel_case",
      },
    );

    const list = res?.data ?? [];

    const batches: BulkImportBatch[] = list.map((b) => ({
      file_name: b.file_name ?? "",
      original_file_name: b.original_file_name ?? b.file_name ?? "",
      company_id: b.company_id ?? null,
      timestamp: b.timestamp ?? null,
      first_uploaded: b.first_uploaded ?? null,
      last_uploaded: b.last_uploaded ?? null,
      assigned_leads: b.assigned_leads ?? 0,
      unassigned_leads: b.unassigned_leads ?? 0,
      total_leads: b.total_leads ?? 0,
      has_assigned_leads: b.has_assigned_leads ?? false,
      assignment_status: b.assignment_status ?? "unassigned",
    }));

    return { total: batches.length, batches };
  },
};

toolRegistry.register(listBulkImportBatchesTool);
