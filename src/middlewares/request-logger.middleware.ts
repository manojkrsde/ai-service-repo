import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

import logger from "../config/logger.js";

declare module "express-serve-static-core" {
  interface Request {
    id?: string;
  }
  interface Locals {
    outSample?: string;
  }
}

const MAX_SAMPLE_BYTES = 512;
const REDACT_KEYS = new Set([
  "authorization",
  "password",
  "token",
  "secret",
  "jwt",
  "access_token",
  "accessToken",
  "refresh_token",
  "refreshToken",
  "cachedToken",
  "cachedSignature",
  "signature",
]);

function sample(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    const stringified = JSON.stringify(value, (key, val) => {
      if (REDACT_KEYS.has(key)) return "[REDACTED]";
      return val;
    });
    if (!stringified) return undefined;
    if (Buffer.byteLength(stringified, "utf8") <= MAX_SAMPLE_BYTES) {
      return stringified;
    }
    return stringified.slice(0, MAX_SAMPLE_BYTES) + "…";
  } catch {
    return undefined;
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

  logger.info(
    {
      reqId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      ua: req.headers["user-agent"],
      bodySample: sample(req.body),
    },
    "request.in",
  );

  const originalJson = res.json.bind(res);
  res.json = (body: unknown): Response => {
    const sampled = sample(body);
    if (sampled !== undefined) res.locals.outSample = sampled;
    return originalJson(body);
  };

  res.on("finish", () => {
    logger.info(
      {
        reqId,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
        outSample: res.locals.outSample,
      },
      "request.out",
    );
  });

  next();
}
