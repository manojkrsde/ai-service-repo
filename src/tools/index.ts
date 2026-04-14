import "./definitions/ping.tool.js";

export { toolRegistry } from "./registry.js";
export { executeTool } from "./executor.js";
export { toMcpTool, type McpToolProjection } from "./adapters/mcp.js";
export { toOpenAITool, type OpenAITool } from "./adapters/openai.js";
export { toAnthropicTool, type AnthropicTool } from "./adapters/anthropic.js";

export type {
  AnyToolDefinition,
  ToolAnnotations,
  ToolContext,
  ToolDefinition,
  ToolErrorCode,
  ToolFail,
  ToolInputSchema,
  ToolOk,
  ToolOutcome,
} from "../types/tool.types.js";

export {
  ToolNotFoundError,
  ToolAlreadyRegisteredError,
} from "../errors/tool.errors.js";
