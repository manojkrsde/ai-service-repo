import type { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StatusCodes } from "http-status-codes";

import logger from "../../config/logger.js";
import { createMcpServer } from "../server.js";
import { authorize } from "./auth.util.js";

async function handleStateless(req: Request, res: Response): Promise<void> {
  const auth = await authorize(req, res);
  if (!auth) return;

  const server = createMcpServer(auth);
  // Stateless mode: omit sessionIdGenerator so the SDK issues no session ID
  // and skips session validation. Safe for Vercel serverless because every
  // request builds its own transport+server.
  const transport = new StreamableHTTPServerTransport({});

  const cleanup = (): void => {
    transport.close().catch(() => {});
    server.close().catch(() => {});
  };
  res.on("close", cleanup);

  try {
    await server.connect(transport as unknown as Transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    logger.error(
      { err, reqId: req.id, path: req.path },
      "Streamable MCP request failed",
    );
    if (!res.headersSent) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
}

export async function streamablePostHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await handleStateless(req, res);
}

export async function streamableGetHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await handleStateless(req, res);
}

export async function streamableDeleteHandler(
  req: Request,
  res: Response,
): Promise<void> {
  await handleStateless(req, res);
}
