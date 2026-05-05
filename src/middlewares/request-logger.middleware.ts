import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

import config from "../config/env.js";
import logger from "../config/logger.js";
import { logRequest } from "../helpers/dbLogger.js";

declare module "express-serve-static-core" {
  interface Request {
    id?: string;
  }
}

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const headerId = req.headers["x-request-id"];
  const reqId =
    typeof headerId === "string" && headerId.length > 0
      ? headerId
      : randomUUID();
  req.id = reqId;
  res.setHeader("x-request-id", reqId);

  const start = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const fields = {
      reqId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
      ip: req.ip,
      ua: req.headers["user-agent"],
    };

    if (res.statusCode >= 500) {
      logger.error(fields, "request.out");
    } else if (res.statusCode >= 400) {
      logger.warn(fields, "request.out");
    } else if (durationMs >= config.logging.slowRequestMs) {
      logger.warn(fields, "request.slow");
    } else {
      logger.debug(fields, "request.out");
    }

    // Fire-and-forget DB log
    const level =
      res.statusCode >= 400 ? "error" : res.statusCode >= 400 ? "warn" : "info";

    // Extract error info stashed by globalErrorHandler
    const errorMessage =
      typeof res.locals["_errorMessage"] === "string"
        ? res.locals["_errorMessage"]
        : undefined;
    const errorStack =
      typeof res.locals["_errorStack"] === "string"
        ? res.locals["_errorStack"]
        : undefined;

    // Extract user_id from Bearer token payload if present
    const userId =
      typeof res.locals["_userId"] === "string"
        ? res.locals["_userId"]
        : undefined;

    // Extract MCP tool name from JSON-RPC request body
    const body = req.body as Record<string, unknown> | undefined;
    const params =
      body?.["method"] === "tools/call"
        ? (body["params"] as Record<string, unknown> | undefined)
        : undefined;
    const toolName =
      typeof params?.["name"] === "string" ? params["name"] : undefined;

    logRequest({
      reqId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
      ip: req.ip,
      level,
      errorMessage,
      errorStack,
      userId,
      toolName,
    });
  });

  next();
}
