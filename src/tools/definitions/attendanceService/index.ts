import type { AnyToolDefinition } from "../../../types/tool.types.js";

export * from "./attendance/index.js";
export * from "./leave/index.js";
export * from "./reports/index.js";

import { getAttendanceByDateTool } from "./attendance/getAttendanceByDate.tool.js";
import { getAttendanceByEmployeeTool } from "./attendance/getAttendanceByEmployee.tool.js";
import { getAttendanceSummaryTool } from "./attendance/getAttendanceSummary.tool.js";

import { applyLeaveTool } from "./leave/applyLeave.tool.js";
import { approveLeaveTool } from "./leave/approveLeave.tool.js";
import { rejectLeaveTool } from "./leave/rejectLeave.tool.js";
import { cancelLeaveTool } from "./leave/cancelLeave.tool.js";
import { getLeaveBalanceTool } from "./leave/getLeaveBalance.tool.js";
import { getLeaveHistoryTool } from "./leave/getLeaveHistory.tool.js";
import { updateLeaveBalanceTool } from "./leave/updateLeaveBalance.tool.js";

import { attendanceReportTool } from "./reports/attendanceReport.tool.js";
import { leaveReportTool } from "./reports/leaveReport.tool.js";
import { absenteeismReportTool } from "./reports/absenteeismReport.tool.js";

export const attendanceServiceTools: AnyToolDefinition[] = [
  // attendance
  getAttendanceByDateTool,
  getAttendanceByEmployeeTool,
  getAttendanceSummaryTool,
  // leave
  applyLeaveTool,
  approveLeaveTool,
  rejectLeaveTool,
  cancelLeaveTool,
  getLeaveBalanceTool,
  getLeaveHistoryTool,
  updateLeaveBalanceTool,
  // reports
  attendanceReportTool,
  leaveReportTool,
  absenteeismReportTool,
];
