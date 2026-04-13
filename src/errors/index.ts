export {
  BaseError,
  type SerializedError,
  type ErrorSeverity,
  type ErrorCategory,
} from "./base.error.js";

export {
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableError,
  TooManyRequestsError,
  DatabaseError,
  ExternalServiceError,
  InternalError,
  ServiceUnavailableError,
  type HttpError,
} from "./http.errors.js";
