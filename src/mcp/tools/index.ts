import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { McpToolLogs } from "../../models/McpToolLogs.js";
import {
  executeTool,
  toMcpTool,
  toolRegistry,
  type AnyToolDefinition,
  type ToolContext,
  type ToolOutcome,
} from "../../tools/index.js";
import type { SessionAuth } from "../auth.types.js";

function toCallToolResult(outcome: ToolOutcome): CallToolResult {
  if (outcome.ok) {
    const text =
      typeof outcome.data === "string"
        ? outcome.data
        : JSON.stringify(outcome.data);
    return {
      content: [{ type: "text", text }],
      isError: false,
    };
  }

  const details =
    outcome.code === "VALIDATION" && outcome.issues
      ? ` ${JSON.stringify(outcome.issues)}`
      : "";

  return {
    content: [
      { type: "text", text: `[${outcome.code}] ${outcome.message}${details}` },
    ],
    isError: true,
  };
}

function bindTool(
  server: McpServer,
  def: AnyToolDefinition,
  auth: SessionAuth,
): void {
  const { name, config } = toMcpTool(def);

  server.registerTool(name, config, async (rawInput: unknown) => {
    const start = Date.now();
    const ctx: ToolContext = {
      sessionAuth: auth,
      companyId: auth.companyId,
      companyType: auth.companyType,
      userId: auth.userId,
    };
    const outcome = await executeTool(name, rawInput, ctx);

    void McpToolLogs.record({
      user_id: auth.userId,
      email: auth.email,
      tool_name: name,
      client_id: auth.clientName,
      status: outcome.ok ? "success" : "error",
      error_code: outcome.ok ? null : outcome.code,
      duration_ms: Date.now() - start,
    });

    return toCallToolResult(outcome);
  });
}

export function registerTools(server: McpServer, auth: SessionAuth): void {
  for (const def of toolRegistry.list()) {
    bindTool(server, def, auth);
  }
}
