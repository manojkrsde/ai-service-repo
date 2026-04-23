import type { AnyToolDefinition } from "../../../types/tool.types.js";

import { listDepartmentsTool } from "./listDepartments.tool.js";
import { listEmployeesTool } from "./listEmployees.tool.js";

export const userServiceTools: AnyToolDefinition[] = [
  listDepartmentsTool,
  listEmployeesTool,
];
