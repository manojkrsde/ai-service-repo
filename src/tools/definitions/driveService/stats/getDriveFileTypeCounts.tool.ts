import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({});

interface FileTypeCounts {
  folder: number;
  image: number;
  video: number;
  pdf: number;
  other: number;
}

interface GetDriveFileTypeCountsResult {
  counts: FileTypeCounts;
  total_files: number;
}

interface FileTypeCountsResponse {
  data?: { data?: Partial<FileTypeCounts> };
}

export const getDriveFileTypeCountsTool: ToolDefinition<
  typeof schema,
  GetDriveFileTypeCountsResult
> = {
  name: "get_drive_file_type_counts",
  title: "Get counts of the caller's drive files by type",
  description:
    "Returns a breakdown of the caller's owned drive items by type: folder, image, video, " +
    "pdf, and other. Each value is a count of items where `owner_id = caller`, `status = 1` " +
    "(active), and `upload_source_type = false` (excludes bulk org documents)." +
    "\n\nUNDERSTANDING THE FLOW: Backend runs a single GROUP BY against `t_drive_items` " +
    "categorising mime_type into the five buckets. company_id / company_type are NOT used by " +
    "this query — it is strictly per-user." +
    "\n\nUSE THIS TOOL TO: render a storage-overview pie chart, summarise 'how many PDFs do I " +
    "have', or compute total file count quickly." +
    "\n\nNOTE: This counts only the caller's OWNED files. For shared / official document " +
    "counts there is no MCP tool today — fetch the lists and count client-side.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["drive", "stats"] },

  handler: async (_input, ctx) => {
    const res = await apiPost<FileTypeCountsResponse>(
      `${SERVICE.DRIVE}/getFileTypeCounts`,
      {},
      ctx,
      { injectCompanyContext: false },
    );

    const raw = res?.data?.data ?? {};
    const counts: FileTypeCounts = {
      folder: raw.folder ?? 0,
      image: raw.image ?? 0,
      video: raw.video ?? 0,
      pdf: raw.pdf ?? 0,
      other: raw.other ?? 0,
    };

    return {
      counts,
      total_files:
        counts.folder + counts.image + counts.video + counts.pdf + counts.other,
    };
  },
};

toolRegistry.register(getDriveFileTypeCountsTool);
