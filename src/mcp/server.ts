import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import config from "../config/env.js";
import type { SessionAuth } from "./auth.types.js";
import { registerTools } from "./tools/index.js";

export function createMcpServer(auth: SessionAuth): McpServer {
  const server = new McpServer({
    name: config.app.name,
    version: "1.0.0",
  });

  registerTools(server, auth);

  return server;
}
