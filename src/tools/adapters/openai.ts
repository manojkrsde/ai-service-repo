import { z } from "zod";

import type { AnyToolDefinition } from "../../types/tool.types.js";

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export function toOpenAITool(def: AnyToolDefinition): OpenAITool {
  return {
    type: "function",
    function: {
      name: def.name,
      description: def.description,
      parameters: z.toJSONSchema(def.inputSchema) as Record<string, unknown>,
    },
  };
}
