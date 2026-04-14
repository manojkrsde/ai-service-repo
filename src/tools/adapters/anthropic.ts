import { z } from "zod";

import type { AnyToolDefinition } from "../../types/tool.types.js";

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export function toAnthropicTool(def: AnyToolDefinition): AnthropicTool {
  return {
    name: def.name,
    description: def.description,
    input_schema: z.toJSONSchema(def.inputSchema) as Record<string, unknown>,
  };
}
