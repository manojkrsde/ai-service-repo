import type { z } from "zod";

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  idempotentHint?: boolean;
  destructiveHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolContext {
  requestId?: string;
  sessionId?: string;
}

export type ToolInputSchema = z.ZodObject<z.ZodRawShape>;

export interface ToolDefinition<
  TSchema extends ToolInputSchema = ToolInputSchema,
  TOutput = unknown,
> {
  name: string;
  title?: string;
  description: string;
  inputSchema: TSchema;
  annotations?: ToolAnnotations;
  meta?: Record<string, unknown>;
  handler: (input: z.infer<TSchema>, ctx: ToolContext) => Promise<TOutput>;
}

export type AnyToolDefinition = ToolDefinition<ToolInputSchema, unknown>;

export type ToolErrorCode = "NOT_FOUND" | "VALIDATION" | "HANDLER";

export interface ToolOk<T = unknown> {
  ok: true;
  data: T;
}

export interface ToolFail {
  ok: false;
  code: ToolErrorCode;
  message: string;
  issues?: z.core.$ZodIssue[];
  cause?: unknown;
}

export type ToolOutcome<T = unknown> = ToolOk<T> | ToolFail;
