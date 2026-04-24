/**
 * Updates priority and/or form-response fields on an existing lead.
 *
 * Routes by field type to match backend contracts:
 *   - priority change →  POST /updateLeadPriority  (body: { id, priority })
 *   - form fields     →  POST /editLeadResponse    (body: { lead_id, response })
 *
 * Both endpoints reject unknown body keys, so company context is suppressed.
 * Stage changes belong in move_lead_to_stage (not yet exported).
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z
  .object({
    lead_id: z
      .number()
      .int()
      .positive()
      .describe("The internal CRM ID of the lead to update"),
    priority: z
      .enum(["Low", "Medium", "High", "Urgent"])
      .optional()
      .describe(
        "New priority level. When provided, calls /updateLeadPriority. Case-sensitive: one of Low, Medium, High, Urgent.",
      ),
    fields: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        "Full replacement map of form-response fields (keys match the form's field names, e.g. 'Full Name', 'Mobile No', 'Email'). When provided, calls /editLeadResponse with the whole object — always include ALL fields you want to keep, not just the ones you're changing.",
      ),
  })
  .refine((v) => v.priority !== undefined || v.fields !== undefined, {
    message:
      "Provide at least one of: priority (routes to /updateLeadPriority) or fields (routes to /editLeadResponse)",
  });

interface UpdateLeadResult {
  success: boolean;
  lead_id: number;
  updated: {
    priority: boolean;
    fields: boolean;
  };
  messages: string[];
}

interface BackendMessageItem {
  msg?: string;
  status?: boolean;
}
interface BackendEnvelope {
  message?: BackendMessageItem[] | BackendMessageItem;
}

function extractMessage(res: BackendEnvelope | undefined): string {
  const m = res?.message;
  if (Array.isArray(m)) {
    return m[0]?.msg ?? "";
  }
  if (m && typeof m === "object") {
    return m.msg ?? "";
  }
  return "";
}

export const updateLeadTool: ToolDefinition<typeof schema, UpdateLeadResult> = {
  name: "update_lead",
  title: "Update lead — change priority or edit form-response fields",
  description:
    "Updates mutable fields on an existing lead record. Supports two update paths, which " +
    "can be combined in a single call:\n" +
    "  • priority → routes to /updateLeadPriority (also writes a PRIORITY_CHANGED activity log).\n" +
    "  • fields → routes to /editLeadResponse, replacing the lead's full form-response object.\n" +
    "\n\nUNDERSTANDING THE FLOW: A lead's form response is stored as one JSON blob; /editLeadResponse " +
    "overwrites that blob in full, so always include every field you want to keep. The name, email, " +
    "and mobile_no columns are derived from the response (keys: 'Full Name', 'Email', 'Mobile No'). " +
    "\n\nUSE THIS TOOL TO: change a lead's priority (Low/Medium/High/Urgent), correct a typo in a " +
    "lead's name/phone/email, or update any captured form field. " +
    "\n\nNOTE: Stage changes (moving a lead through the pipeline) are NOT supported here — a " +
    "move_lead_to_stage tool exists but is deferred to v2. Follow-up-date updates are also not " +
    "supported by /editLeadResponse and require a separate endpoint. If neither priority nor " +
    "fields is provided, the tool rejects the call without hitting the backend.",
  inputSchema: schema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
  },
  meta: { version: "3.0.0", tags: ["action", "leads"] },

  handler: async (input, ctx) => {
    const messages: string[] = [];
    const updated = { priority: false, fields: false };

    if (input.priority !== undefined) {
      const res = await apiPost<BackendEnvelope>(
        `${SERVICE.LEADS}/updateLeadPriority`,
        { id: input.lead_id, priority: input.priority },
        ctx,
        { injectCompanyContext: false },
      );
      updated.priority = true;
      const msg = extractMessage(res);
      if (msg) messages.push(msg);
    }

    if (input.fields !== undefined) {
      const res = await apiPost<BackendEnvelope>(
        `${SERVICE.LEADS}/editLeadResponse`,
        { lead_id: input.lead_id, response: input.fields },
        ctx,
        { injectCompanyContext: false },
      );
      updated.fields = true;
      const msg = extractMessage(res);
      if (msg) messages.push(msg);
    }

    return {
      success: true,
      lead_id: input.lead_id,
      updated,
      messages,
    };
  },
};

toolRegistry.register(updateLeadTool);
