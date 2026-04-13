import { randomUUID } from "crypto";

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export type ErrorCategory =
  | "validation"
  | "authentication"
  | "authorization"
  | "not_found"
  | "conflict"
  | "rate_limit"
  | "database"
  | "external_service"
  | "internal"
  | "unknown";

export interface SerializedError {
  errorId: string;
  errorCode: string;
  name: string;
  statusCode: number;
  severity: ErrorSeverity;
  category: ErrorCategory;
  message: string;
  isOperational: boolean;
  timestamp: string;
  environment: string;
  appName: string;
  stack?: string;
  context?: Record<string, unknown>;
  request?: {
    requestId?: string;
    method?: string;
    path?: string;
    ip?: string;
    userAgent?: string;
    userId?: string;
  };
}

export abstract class BaseError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;
  abstract readonly severity: ErrorSeverity;
  abstract readonly category: ErrorCategory;

  readonly errorId: string;
  readonly isOperational: boolean;
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    isOperational: boolean = true,
    context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.errorId = randomUUID();
    this.isOperational = isOperational;

    if (context !== undefined) {
      this.context = context;
    }

    Error.captureStackTrace(this, this.constructor);
  }

  serialize(
    appName: string,
    environment: string,
    request?: SerializedError["request"],
  ): SerializedError {
    const serialized: SerializedError = {
      errorId: this.errorId,
      errorCode: this.errorCode,
      name: this.name,
      statusCode: this.statusCode,
      severity: this.severity,
      category: this.category,
      message: this.message,
      isOperational: this.isOperational,
      timestamp: new Date().toISOString(),
      environment,
      appName,
    };

    if (this.stack !== undefined) serialized.stack = this.stack;
    if (this.context !== undefined) serialized.context = this.context;
    if (request !== undefined) serialized.request = request;

    return serialized;
  }
}
