import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface DriveItemSummary {
  id: number;
  name: string;
  type: number | string | null;
  mime_type: string | null;
  size: number | null;
  parent_id: number | null;
  owner_id: number | null;
  status: number | null;
  company_id: number | null;
  company_type: string | null;
  shared_users: unknown[] | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ListMyDriveFilesResult {
  total: number;
  items: DriveItemSummary[];
}

interface RawDriveItem {
  id?: number;
  name?: string;
  type?: number | string | null;
  mime_type?: string | null;
  size?: number | null;
  parent_id?: number | null;
  owner_id?: number | null;
  status?: number | null;
  company_id?: number | null;
  company_type?: string | null;
  is_shared?: boolean;
  share_info?: {
    has_access?: boolean;
    access_type?: string | null;
    shared_count?: number;
    shared_with?: unknown[];
  };
  createdAt?: string;
  updatedAt?: string;
}

interface ListDriveResponse {
  data?: RawDriveItem[];
}

export const listMyDriveFilesTool: ToolDefinition<
  typeof schema,
  ListMyDriveFilesResult
> = {
  name: "list_my_drive_files",
  title: "List the caller's root-level drive files & folders",
  description:
    "Returns every file and folder the caller OWNS at the root level (parent_id is null) " +
    "across all sibling/child companies. Each item carries: id, name, type (1=folder, 2=file), " +
    "mime_type, size in bytes, parent_id, owner_id, status, company context, share permissions, " +
    "and timestamps." +
    "\n\nUNDERSTANDING THE FLOW: Backend resolves visible companies via RabbitMQ and filters " +
    "items where `owner_id = caller`, `parent_id is null`, `status = 1` (active), and " +
    "`upload_source_type = false` (excludes bulk-uploaded org documents — those live in " +
    "`list_official_documents`). company_id / company_type are auto-injected." +
    "\n\nUSE THIS TOOL TO: render the root of the user's drive, count files in the user's " +
    "personal space, or feed item ids into a downstream tool. " +
    "\n\nNOTE: This shows only the root level, not folder contents. To enumerate a folder's " +
    "children there is no MCP tool today — use the frontend UI. For files shared WITH the " +
    "caller (not owned) call `list_shared_files`.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["drive", "files", "list"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<ListDriveResponse>(
      `${SERVICE.DRIVE}/getRootDriveItemsByOwner`,
      {},
      ctx,
      {
        injectCompanyContext: false,
      },
    );

    const list = res?.data ?? [];

    const items: DriveItemSummary[] = list.map((d) => ({
      id: d.id ?? 0,
      name: d.name ?? "",
      type: d.type ?? null,
      mime_type: d.mime_type ?? null,
      size: d.size ?? null,
      parent_id: d.parent_id ?? null,
      owner_id: d.owner_id ?? null,
      status: d.status ?? null,
      company_id: d.company_id ?? null,
      company_type: d.company_type ?? null,
      shared_users: d.share_info?.shared_with ?? null,
      created_at: d.createdAt ?? null,
      updated_at: d.updatedAt ?? null,
    }));

    return { total: items.length, items };
  },
};

toolRegistry.register(listMyDriveFilesTool);
