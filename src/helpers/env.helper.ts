/** Returns a trimmed string env var, or falls back to the default */
export const str = (key: string, fallback: string): string =>
  process.env[key]?.trim() || fallback;

/** Returns a validated integer env var, or throws on invalid value */
export const int = (key: string, fallback: number): number => {
  const val = process.env[key];
  if (!val) return fallback;
  const parsed = parseInt(val, 10);
  if (isNaN(parsed))
    throw new Error(`Env var "${key}" must be an integer, got: "${val}"`);
  return parsed;
};

/** Returns a validated boolean env var ("true"/"false"/"1"/"0"), or throws on invalid value */
export const bool = (key: string, fallback: boolean): boolean => {
  const val = process.env[key]?.trim().toLowerCase();
  if (!val) return fallback;
  if (val === "true" || val === "1") return true;
  if (val === "false" || val === "0") return false;
  throw new Error(`Env var "${key}" must be a boolean, got: "${val}"`);
};

/** Strips one or more trailing slashes from a URL string */
export const stripTrailingSlash = (value: string): string =>
  value.replace(/\/+$/, "");

/** Returns a trimmed, slash-normalized URL env var, or falls back to the default */
export const url = (key: string, fallback: string): string =>
  stripTrailingSlash(process.env[key]?.trim() || fallback);

/**
 * Validates that an env var's value is one of the allowed literals.
 * Returns the narrowed union type, or throws with a clear message.
 *
 * @example
 *   type LogLevel = "info" | "debug" | "error";
 *   const level = enumerator<LogLevel>("LOG_LEVEL", "info", ["info", "debug", "error"]);
 */
export const enumerator = <T extends string>(
  key: string,
  fallback: T,
  allowed: readonly T[],
): T => {
  const val = process.env[key]?.trim() as T | undefined;
  if (!val) return fallback;
  if (allowed.includes(val)) return val;
  throw new Error(
    `Env var "${key}" must be one of [${allowed.join(", ")}], got: "${val}"`,
  );
};
