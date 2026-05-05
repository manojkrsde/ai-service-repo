import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface ListOfficialDocumentsResult {
  total: number;
  documents: OfficialDocumentSummary[];
}

interface RawOfficialDoc {
  file?: {
    id?: number;
    name?: string;
    mime_type?: string | null;
    size?: number | null;
    owner_id?: number | null;
    upload_source_type?: boolean | null;
    document_type?: string | null;
    is_bulk_upload?: boolean;
    company_id?: number | null;
    company_type?: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
  access_type?: string | null;
  access_via?: string | null;
  rule_type?: string | null;
  status?: string | null;
}

interface OfficialDocumentSummary {
  id: number;
  name: string;
  mime_type: string | null;
  size: number | null;
  owner_id: number | null;
  document_type: string | null;
  is_bulk_upload: boolean;
  access_type: string | null;
  access_via: string | null;
  rule_type: string | null;
  company_id: number | null;
  company_type: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ListOfficialDocsResponse {
  data?: { data?: RawOfficialDoc[] };
}

export const listOfficialDocumentsTool: ToolDefinition<
  typeof schema,
  ListOfficialDocumentsResult
> = {
  name: "list_official_documents",
  title: "List company official documents the caller can access",
  description:
    "Returns every organization-uploaded official document the calling user has access to — " +
    "policies, handbooks, contracts, training material, etc. Bulk-uploaded docs are scoped via " +
    "share rules (department / role / location / individual user) rather than per-file " +
    "permissions. Each row carries id, name, mime_type, size, uploader, share_rules JSON, and " +
    "company context." +
    "\n\nUNDERSTANDING THE FLOW: Backend evaluates the bulk-upload share rules against the " +
    "calling user's profile (department, role_char, location, user_id) and returns only matching " +
    "documents. Soft-deleted docs (`status != 1`) are excluded. company_id / company_type are " +
    "auto-injected." +
    "\n\nUSE THIS TOOL TO: render the org's document library, surface 'official' files in the " +
    "drive sidebar, or feed an LLM a corpus of company policies for retrieval." +
    "\n\nNOTE: For files the user uploaded themselves call `list_my_drive_files`. For files " +
    "shared by individuals call `list_shared_files`.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["drive", "files", "official", "list"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<ListOfficialDocsResponse>(
      `${SERVICE.DRIVE}/getUserAccessibleOfficialDocuments`,
      {},
      ctx,
      {
        injectCompanyContext: false,
      },
    );

    const list = res?.data?.data ?? [];

    const documents: OfficialDocumentSummary[] = list.map((d) => ({
      id: d.file?.id ?? 0,
      name: d.file?.name ?? "",
      mime_type: d.file?.mime_type ?? null,
      size: d.file?.size ?? null,
      owner_id: d.file?.owner_id ?? null,
      document_type: d.file?.document_type ?? null,
      is_bulk_upload: d.file?.is_bulk_upload ?? false,
      access_type: d.access_type ?? null,
      access_via: d.access_via ?? null,
      rule_type: d.rule_type ?? null,
      company_id: d.file?.company_id ?? null,
      company_type: d.file?.company_type ?? null,
      created_at: d.file?.createdAt ?? null,
      updated_at: d.file?.updatedAt ?? null,
    }));

    return { total: documents.length, documents };
  },
};

toolRegistry.register(listOfficialDocumentsTool);
