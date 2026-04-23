import "./definitions/ping.tool.js";

import "./definitions/userService/index.js"; // user service ( all groups)
import "./definitions/leadsService/index.js"; // Leads service (all groups)
import "./definitions/attendanceService/index.js"; // Attendance service (all groups)

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
