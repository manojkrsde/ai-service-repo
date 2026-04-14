import type { ToolAnnotations as McpToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";

import type { AnyToolDefinition } from "../../types/tool.types.js";

export interface McpToolProjection {
  name: string;
  config: {
    title?: string;
    description: string;
    inputSchema: z.ZodRawShape;
    annotations?: McpToolAnnotations;
    _meta?: Record<string, unknown>;
  };
}

export function toMcpTool(def: AnyToolDefinition): McpToolProjection {
  const config: McpToolProjection["config"] = {
    description: def.description,
    inputSchema: def.inputSchema.shape,
  };

  if (def.title !== undefined) config.title = def.title;
  if (def.annotations !== undefined) {
    config.annotations = def.annotations as McpToolAnnotations;
  }
  if (def.meta !== undefined) config._meta = def.meta;

  return { name: def.name, config };
}
