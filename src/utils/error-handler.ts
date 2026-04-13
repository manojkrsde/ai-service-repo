import type {
  Request,
  Response,
  NextFunction,
  ErrorRequestHandler,
} from "express";

import { BaseError, type SerializedError } from "../errors/index.js";
import logger from "../config/logger.js";
import config from "../config/env.js";

export const isBaseError = (err: unknown): err is BaseError =>
  err instanceof BaseError;
export const isNativeError = (err: unknown): err is Error =>
  err instanceof Error;

const extractRequest = (req: Request): SerializedError["request"] => {
  const request: SerializedError["request"] = {};

  const requestId = req.headers["x-request-id"];
  const userAgent = req.headers["user-agent"];

  if (typeof requestId === "string") request.requestId = requestId;
  if (typeof req.method === "string") request.method = req.method;
  if (typeof req.path === "string") request.path = req.path;
  if (req.ip !== undefined) request.ip = req.ip;
  if (typeof userAgent === "string") request.userAgent = userAgent;

  return request;
};

const normalize = (err: unknown, req: Request): SerializedError => {
  const request = extractRequest(req);

  if (isBaseError(err)) {
    return err.serialize(config.app.name, config.app.env, request);
  }

  if (isNativeError(err)) {
    const serialized: SerializedError = {
      errorId: crypto.randomUUID(),
      errorCode: "INTERNAL_SERVER_ERROR",
      name: err.name,
      statusCode: 500,
      severity: "high",
      category: "unknown",
      message: err.message,
      isOperational: false,
      timestamp: new Date().toISOString(),
      environment: config.app.env,
      appName: config.app.name,
    };

    if (err.stack !== undefined) serialized.stack = err.stack;
    if (request !== undefined) serialized.request = request;

    return serialized;
  }

  const serialized: SerializedError = {
    errorId: crypto.randomUUID(),
    errorCode: "UNKNOWN_ERROR",
    name: "UnknownError",
    statusCode: 500,
    severity: "critical",
    category: "unknown",
    message: "An unexpected error occurred.",
    isOperational: false,
    timestamp: new Date().toISOString(),
    environment: config.app.env,
    appName: config.app.name,
  };

  if (request !== undefined) serialized.request = request;

  return serialized;
};

const logBySeverity = (serialized: SerializedError): void => {
  const payload = { ...serialized };

  switch (serialized.severity) {
    case "critical":
      logger.fatal(payload, serialized.message);
      break;
    case "high":
      logger.error(payload, serialized.message);
      break;
    case "medium":
      logger.warn(payload, serialized.message);
      break;
    case "low":
      logger.warn(payload, serialized.message);
      break;
  }
};

interface ErrorResponse {
  success: false;
  errorId: string;
  errorCode: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    errorId: crypto.randomUUID(),
    errorCode: "NOT_FOUND",
    message: `Route ${req.method} ${req.path} not found.`,
  } satisfies ErrorResponse);
};

export const globalErrorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const serialized = normalize(err, req);

  logBySeverity(serialized);

  const body: ErrorResponse = {
    success: false,
    errorId: serialized.errorId,
    errorCode: serialized.errorCode,
    message:
      !serialized.isOperational && config.app.isProd
        ? "Internal server error."
        : serialized.message,
  };

  if (!config.app.isProd) {
    if (serialized.stack !== undefined) body.stack = serialized.stack;
    if (serialized.context !== undefined) body.context = serialized.context;
  }

  res.status(serialized.statusCode).json(body);
};
