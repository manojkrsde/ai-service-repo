import {
  type ErrorCategory,
  type ErrorSeverity,
  BaseError,
} from "./base.errors.js";

const makeHttpError = (
  defaultStatusCode: number,
  defaultErrorCode: string,
  defaultMessage: string,
  severity: ErrorSeverity,
  category: ErrorCategory,
  isOperational: boolean = true,
) => {
  return class extends BaseError {
    readonly statusCode = defaultStatusCode;
    readonly errorCode = defaultErrorCode;
    readonly severity = severity;
    readonly category = category;

    constructor(message = defaultMessage, context?: Record<string, unknown>) {
      super(message, isOperational, context);
    }
  };
};

export const BadRequestError = makeHttpError(
  400,
  "BAD_REQUEST",
  "Bad request.",
  "low",
  "validation",
);

export const UnauthorizedError = makeHttpError(
  401,
  "UNAUTHORIZED",
  "Unauthorized.",
  "low",
  "authentication",
);

export const ForbiddenError = makeHttpError(
  403,
  "FORBIDDEN",
  "Forbidden.",
  "low",
  "authorization",
);

export const NotFoundError = makeHttpError(
  404,
  "NOT_FOUND",
  "Resource not found.",
  "low",
  "not_found",
);

export const ConflictError = makeHttpError(
  409,
  "CONFLICT",
  "Resource already exists.",
  "low",
  "conflict",
);

export const UnprocessableError = makeHttpError(
  422,
  "UNPROCESSABLE_ENTITY",
  "Validation failed.",
  "low",
  "validation",
);

export const TooManyRequestsError = makeHttpError(
  429,
  "TOO_MANY_REQUESTS",
  "Too many requests.",
  "medium",
  "rate_limit",
);

export const DatabaseError = makeHttpError(
  500,
  "DATABASE_ERROR",
  "Database operation failed.",
  "high",
  "database",
  false,
);

export const ExternalServiceError = makeHttpError(
  502,
  "EXTERNAL_SERVICE_ERROR",
  "External service failed.",
  "medium",
  "external_service",
  true,
);

export const InternalError = makeHttpError(
  500,
  "INTERNAL_SERVER_ERROR",
  "Internal server error.",
  "high",
  "internal",
  false,
);

export const ServiceUnavailableError = makeHttpError(
  503,
  "SERVICE_UNAVAILABLE",
  "Service temporarily unavailable.",
  "high",
  "internal",
  false,
);

export type HttpError =
  | InstanceType<typeof BadRequestError>
  | InstanceType<typeof UnauthorizedError>
  | InstanceType<typeof ForbiddenError>
  | InstanceType<typeof NotFoundError>
  | InstanceType<typeof ConflictError>
  | InstanceType<typeof UnprocessableError>
  | InstanceType<typeof TooManyRequestsError>
  | InstanceType<typeof DatabaseError>
  | InstanceType<typeof ExternalServiceError>
  | InstanceType<typeof InternalError>
  | InstanceType<typeof ServiceUnavailableError>;
