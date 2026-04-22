import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

import config from "../config/env.js";
import logger from "../config/logger.js";

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
  });

  next();
}
