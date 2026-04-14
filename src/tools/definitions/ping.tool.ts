import { z } from "zod";

import { toolRegistry } from "../registry.js";
import { type ToolDefinition } from "../../types/tool.types.js";

const pingInputSchema = z.object({});

export const pingTool: ToolDefinition<typeof pingInputSchema, string> = {
  name: "ping",
  title: "Ping",
  description: "Health check tool that returns a pong response.",
  inputSchema: pingInputSchema,
  annotations: {
    readOnlyHint: true,
    idempotentHint: true,
    destructiveHint: false,
    openWorldHint: false,
  },
  meta: {
    version: "1.0.0",
    tags: ["health", "diagnostic"],
  },
  handler: async () => "pong",
};

toolRegistry.register(pingTool);
