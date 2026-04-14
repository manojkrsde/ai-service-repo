import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerPingTool } from "./ping.tool.js";

export function registerTools(server: McpServer): void {
  registerPingTool(server);
  // registerSearchTool(server);  ← future tools slot in here
  // registerSummarizeTool(server);
}
