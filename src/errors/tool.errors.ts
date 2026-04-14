import { BaseError } from "./base.errors.js";

export class ToolNotFoundError extends BaseError {
  readonly statusCode = 404;
  readonly errorCode = "TOOL_NOT_FOUND";
  readonly severity = "low" as const;
  readonly category = "not_found" as const;

  constructor(toolName: string, context?: Record<string, unknown>) {
    super(`Tool "${toolName}" is not registered.`, true, {
      toolName,
      ...context,
    });
  }
}

export class ToolAlreadyRegisteredError extends BaseError {
  readonly statusCode = 409;
  readonly errorCode = "TOOL_ALREADY_REGISTERED";
  readonly severity = "medium" as const;
  readonly category = "conflict" as const;

  constructor(toolName: string) {
    super(`Tool "${toolName}" is already registered.`, false, { toolName });
  }
}
