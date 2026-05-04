import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface SharedFileSummary {
  id: number;
  name: string;
  type: number | string | null;
  mime_type: string | null;
  size: number | null;
  owner_id: number | null;
  granted_by: number | null;
  access_type: string | null;
  shared_at: string | null;
  company_id: number | null;
  company_type: string | null;
}

interface ListSharedFilesResult {
  total: number;
  files: SharedFileSummary[];
}

interface RawSharedFile {
  file?: {
    id?: number;
    name?: string;
    type?: number | string | null;
    mime_type?: string | null;
    size?: number | null;
    owner_id?: number | null;
    company_id?: number | null;
    company_type?: string | null;
    createdAt?: string;
  };
  access_type?: string | null;
  share_details?: {
    shared_by?: {
      user_id?: number | null;
      name?: string;
      email?: string;
    };
    shared_at?: string | null;
    share_status?: string | null;
    permission_id?: number | null;
  };
}

interface ListSharedFilesResponse {
  data?: { data?: RawSharedFile[] };
}

export const listSharedFilesTool: ToolDefinition<
  typeof schema,
  ListSharedFilesResult
> = {
  name: "list_shared_files",
  title: "List drive files shared with the caller",
  description:
    "Returns every drive file other users have shared with the caller — i.e. the caller is in " +
    "the file's `users_access` permission list with status='active'. Each row includes id, " +
    "name, type, mime_type, size, original owner_id, the user who granted access, the " +
    "access_type granted (view/edit/etc.), and the share timestamp." +
    "\n\nUNDERSTANDING THE FLOW: Backend joins `m_file_permissions` to `t_drive_items`, filters " +
    "by users_access entries that match the calling user, and returns only active permissions. " +
    "company_id / company_type are auto-injected." +
    "\n\nUSE THIS TOOL TO: render an 'Inbox' / 'Shared with me' view, count how many files the " +
    "caller has access to via shares, or look up who granted access to what." +
    "\n\nNOTE: Files the user OWNS are not in this list — call `list_my_drive_files` for those. " +
    "For organization-wide official documents call `list_official_documents`.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["drive", "files", "shared", "list"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<ListSharedFilesResponse>(
      `${SERVICE.DRIVE}/getPermissionedFileByUserId`,
      {},
      ctx,
      {
        injectCompanyContext: false,
      },
    );

    const list = res?.data?.data ?? [];

    const files: SharedFileSummary[] = list.map((f) => ({
      id: f.file?.id ?? 0,
      name: f.file?.name ?? "",
      type: f.file?.type ?? null,
      mime_type: f.file?.mime_type ?? null,
      size: f.file?.size ?? null,
      owner_id: f.file?.owner_id ?? null,
      granted_by: f.share_details?.shared_by?.user_id ?? null,
      access_type: f.access_type ?? null,
      shared_at: f.share_details?.shared_at ?? f.file?.createdAt ?? null,
      company_id: f.file?.company_id ?? null,
      company_type: f.file?.company_type ?? null,
    }));

    return { total: files.length, files };
  },
};

toolRegistry.register(listSharedFilesTool);
