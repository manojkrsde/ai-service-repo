import {
  type AnyToolDefinition,
  type ToolDefinition,
  type ToolInputSchema,
} from "../types/tool.types.js";
import { ToolAlreadyRegisteredError } from "../errors/tool.errors.js";

class ToolRegistry {
  private readonly tools = new Map<string, AnyToolDefinition>();

  register<TSchema extends ToolInputSchema, TOutput>(
    def: ToolDefinition<TSchema, TOutput>,
  ): void {
    if (this.tools.has(def.name)) {
      throw new ToolAlreadyRegisteredError(def.name);
    }
    this.tools.set(def.name, def as AnyToolDefinition);
  }

  get(name: string): AnyToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(
    predicate?: (def: AnyToolDefinition) => boolean,
  ): AnyToolDefinition[] {
    const all = Array.from(this.tools.values());
    return predicate ? all.filter(predicate) : all;
  }

  size(): number {
    return this.tools.size;
  }
}

export const toolRegistry = new ToolRegistry();
export type { ToolRegistry };
