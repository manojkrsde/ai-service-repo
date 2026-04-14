import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

//  Streamable HTTP session
export interface StreamableSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
}

class StreamableSessionStore {
  private readonly sessions = new Map<string, StreamableSession>();

  set(sessionId: string, session: StreamableSession): void {
    this.sessions.set(sessionId, session);
  }

  get(sessionId: string): StreamableSession | undefined {
    return this.sessions.get(sessionId);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  get size(): number {
    return this.sessions.size;
  }
}

export const streamableSessionStore = new StreamableSessionStore();
