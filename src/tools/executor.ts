import { type ToolContext, type ToolOutcome } from "../types/tool.types.js";
import { toolRegistry } from "./registry.js";

export async function executeTool(
  name: string,
  rawInput: unknown,
  ctx: ToolContext = {},
): Promise<ToolOutcome> {
  const def = toolRegistry.get(name);

  if (!def) {
    return {
      ok: false,
      code: "NOT_FOUND",
      message: `Tool "${name}" is not registered.`,
    };
  }

  const parsed = def.inputSchema.safeParse(rawInput ?? {});

  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: `Invalid input for tool "${name}".`,
      issues: parsed.error.issues,
    };
  }

  try {
    const data = await def.handler(parsed.data, { ...ctx, invokedName: name });
    return { ok: true, data };
  } catch (cause) {
    return {
      ok: false,
      code: "HANDLER",
      message:
        cause instanceof Error
          ? cause.message
          : `Tool "${name}" handler failed.`,
      cause,
    };
  }
}
