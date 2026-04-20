import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export interface SessionAuth {
  email: string;
  userId: number;
  companyId: number;
  companyType: string;
  role: string;
  cachedToken: string;
  cachedSignature: string;
}

export interface StreamableSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  auth: SessionAuth;
}

class StreamableSessionStore {
  private readonly sessions = new Map<string, StreamableSession>();
  private readonly lastSeen = new Map<string, number>();
  private readonly TTL_MS = 30 * 60 * 1000;

  constructor() {
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  set(sessionId: string, session: StreamableSession): void {
    this.sessions.set(sessionId, session);
    this.lastSeen.set(sessionId, Date.now());
  }

  get(sessionId: string): StreamableSession | undefined {
    if (this.sessions.has(sessionId)) {
      this.lastSeen.set(sessionId, Date.now());
    }
    return this.sessions.get(sessionId);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.lastSeen.delete(sessionId);
  }

  get size(): number {
    return this.sessions.size;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [sessionId, ts] of this.lastSeen) {
      if (now - ts > this.TTL_MS) {
        this.delete(sessionId);
      }
    }
  }
}

export const streamableSessionStore = new StreamableSessionStore();
