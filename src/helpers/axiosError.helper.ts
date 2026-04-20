import { AxiosError } from "axios";

export interface ParsedAxiosError {
  status: number;
  message: string;
  errors?: string[];
  raw?: unknown;
  upstream?: string;
}

/**
 * Extracts a user-friendly error from any Axios error shape.
 *
 * Handles:
 *   - { message: "string" }
 *   - { message: [{ msg: "string" }] }          ← express-validator
 *   - { message: [{ message: "string" }] }
 *   - { errors: [{ msg: "string" }] }
 *   - { error: "string" }
 *   - { data: { message: "string" } }            ← nested wrappers
 *   - plain string bodies
 *   - network / timeout / no-response errors
 */
export function parseAxiosError(
  err: unknown,
  upstream?: string,
): ParsedAxiosError {
  const up = upstream ? { upstream } : {};

  if (!(err instanceof Error)) {
    return { status: 500, message: "Unknown error occurred", ...up };
  }

  const axiosErr = err as AxiosError<any>;

  if (axiosErr.response) {
    const { status, data } = axiosErr.response;
    const message = extractMessage(data);
    const errors = extractErrors(data);

    return {
      status,
      message,
      ...(errors.length > 0 && { errors }),
      raw: data,
      ...up,
    };
  }

  if (axiosErr.request) {
    const isTimeout = axiosErr.code === "ECONNABORTED";
    const isRefused = axiosErr.code === "ECONNREFUSED";

    return {
      status: 502,
      message: isTimeout
        ? "Upstream service timed out"
        : isRefused
          ? `Cannot reach upstream service${upstream ? ` (${upstream})` : ""}`
          : "No response from upstream service",
      ...up,
    };
  }

  return {
    status: 500,
    message: axiosErr.message || "Internal request setup error",
    ...up,
  };
}

function extractMessage(data: any): string {
  if (!data) return "Request failed";

  if (typeof data === "string") return data;

  if (typeof data.message === "string") return data.message;

  if (Array.isArray(data.message)) {
    const first = data.message[0];
    if (typeof first?.msg === "string") return first.msg;
    if (typeof first?.message === "string") return first.message;
    if (typeof first === "string") return first;
  }

  if (typeof data.error === "string") return data.error;

  if (Array.isArray(data.errors)) {
    const first = data.errors[0];
    if (typeof first?.msg === "string") return first.msg;
    if (typeof first?.message === "string") return first.message;
  }

  if (data.data) return extractMessage(data.data);

  return "Request failed";
}

function extractErrors(data: any): string[] {
  if (!data) return [];

  const source = data.message ?? data.errors ?? data.data?.errors;

  if (Array.isArray(source)) {
    return source
      .map((e: any) => e?.msg ?? e?.message ?? e)
      .filter((e) => typeof e === "string");
  }

  return [];
}
