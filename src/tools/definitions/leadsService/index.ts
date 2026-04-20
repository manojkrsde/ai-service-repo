import type { AnyToolDefinition } from "../../../types/tool.types.js";

export * from "./crud/index.js";
export * from "./activity/index.js";
export * from "./followups/index.js";
export * from "./stats/index.js";
export * from "./validation/index.js";

import { createLeadTool } from "./crud/createLead.tool.js";
import { getLeadDetailsTool } from "./crud/getLeadDetails.tool.js";
import { updateLeadTool } from "./crud/updateLead.tool.js";
import { deleteLeadTool } from "./crud/deleteLead.tool.js";
import { assignLeadTool } from "./crud/assignLead.tool.js";
import { listLeadsTool } from "./crud/listLeads.tool.js";
import { listLeadsByStageTool } from "./crud/listLeadsByStage.tool.js";
import { listUnassignedLeadsTool } from "./crud/listUnassignedLeads.tool.js";
import { listFormsTool } from "./crud/listForms.tool.js";
import { listPipelinesTool } from "./crud/listPipelines.tool.js";
import { moveLeadToStageTool } from "./crud/moveLeadToStage.tool.js";

import { getLeadActivityTool } from "./activity/getLeadActivity.tool.js";
import { getLeadHistoryTool } from "./activity/getLeadHistory.tool.js";
import { addNoteToLeadTool } from "./activity/addNoteToLead.tool.js";
import { getLeadDashboardTool } from "./activity/getLeadDashboard.tool.js";
import { logCallForLeadTool } from "./activity/logCallForLead.tool.js";

import { addLeadFollowUpTool } from "./followups/addLeadFollowUp.tool.js";
import { getLeadFollowUpsTool } from "./followups/getLeadFollowUps.tool.js";
import { getLeadRemindersTool } from "./followups/getLeadReminders.tool.js";
import { markReminderDoneTool } from "./followups/markReminderDone.tool.js";
import { scheduleReminderTool } from "./followups/scheduleReminder.tool.js";

import { getLeadVolumeStatsTool } from "./stats/getLeadVolumeStats.tool.js";
import { getOverallStageCountsTool } from "./stats/getOverallStageCounts.tool.js";
import { getFormLeadStatsTool } from "./stats/getFormLeadStats.tool.js";
import { getOverdueLeadsTool } from "./stats/getOverdueLeads.tool.js";
import { getPipelineFunnelTool } from "./stats/getPipelineFunnel.tool.js";
import { getUserPerformanceRankingTool } from "./stats/getUserPerformanceRanking.tool.js";

import { checkDuplicatePhoneTool } from "./validation/checkDuplicatePhone.tool.js";
import { searchLeadByPhoneTool } from "./validation/searchLeadByPhone.tool.js";
import { searchLeadByNameTool } from "./validation/searchLeadByName.tool.js";
import { searchLeadByEmailTool } from "./validation/searchLeadByEmail.tool.js";
import { validateLeadDataTool } from "./validation/validateLeadData.tool.js";

export const leadsServiceTools: AnyToolDefinition[] = [
  // crud
  createLeadTool,
  getLeadDetailsTool,
  updateLeadTool,
  deleteLeadTool,
  assignLeadTool,
  listLeadsTool,
  listLeadsByStageTool,
  listUnassignedLeadsTool,
  listFormsTool,
  listPipelinesTool,
  moveLeadToStageTool,
  // activity
  getLeadActivityTool,
  getLeadHistoryTool,
  addNoteToLeadTool,
  getLeadDashboardTool,
  logCallForLeadTool,
  // followups
  addLeadFollowUpTool,
  getLeadFollowUpsTool,
  getLeadRemindersTool,
  markReminderDoneTool,
  scheduleReminderTool,
  // stats
  getLeadVolumeStatsTool,
  getOverallStageCountsTool,
  getFormLeadStatsTool,
  getOverdueLeadsTool,
  getPipelineFunnelTool,
  getUserPerformanceRankingTool,
  // validation
  checkDuplicatePhoneTool,
  searchLeadByPhoneTool,
  searchLeadByNameTool,
  searchLeadByEmailTool,
  validateLeadDataTool,
];
