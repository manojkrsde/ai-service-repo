import {
  type AnyToolDefinition,
  type ToolDefinition,
  type ToolInputSchema,
} from "../types/tool.types.js";
import { ToolAlreadyRegisteredError } from "../errors/tool.errors.js";

class ToolRegistry {
  private readonly tools = new Map<string, AnyToolDefinition>();
  private readonly aliasOf = new Map<string, string>();

  register<TSchema extends ToolInputSchema, TOutput>(
    def: ToolDefinition<TSchema, TOutput>,
  ): void {
    if (this.tools.has(def.name) || this.aliasOf.has(def.name)) {
      throw new ToolAlreadyRegisteredError(def.name);
    }
    for (const alias of def.aliases ?? []) {
      if (this.tools.has(alias) || this.aliasOf.has(alias)) {
        throw new ToolAlreadyRegisteredError(alias);
      }
    }
    this.tools.set(def.name, def as AnyToolDefinition);
    for (const alias of def.aliases ?? []) {
      this.aliasOf.set(alias, def.name);
    }
  }

  get(name: string): AnyToolDefinition | undefined {
    const direct = this.tools.get(name);
    if (direct) return direct;
    const canonical = this.aliasOf.get(name);
    return canonical ? this.tools.get(canonical) : undefined;
  }

  has(name: string): boolean {
    return this.tools.has(name) || this.aliasOf.has(name);
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
