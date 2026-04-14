import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Tool config reference:
 *
 * title        — display name shown in UIs and Inspector
 * description  — explains to the AI when and why to use this tool
 * inputSchema  — Zod shape for tool arguments; omit if no input
 * outputSchema — Zod schema for structuredContent; omit for plain text
 * annotations:
 *   audience        — ["user"] | ["assistant"] | ["user", "assistant"]
 *   readOnlyHint    — true if tool never modifies data
 *   idempotentHint  — true if calling multiple times has the same effect
 *   destructiveHint — true if tool causes irreversible side effects
 *   openWorldHint   — true if tool talks to external/unpredictable systems
 * _meta        — arbitrary metadata for your own tooling, ignored by protocol
 *
 * Handler return:
 *   content  — array of { type: "text", text: string } response blocks
 *   isError  — true to signal a tool-level error (content still returned)
 */

export function registerPingTool(server: McpServer): void {
  server.registerTool(
    "ping",
    {
      title: "Ping",
      description: "Health check tool that returns a pong response",
      // inputSchema — omitted: tool takes no input
      // outputSchema — omitted: returns plain text content only
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        version: "1.0.0",
        tags: ["health", "diagnostic"],
      },
    },
    async () => ({
      content: [{ type: "text", text: "pong" }],
      isError: false,
    }),
  );
}
