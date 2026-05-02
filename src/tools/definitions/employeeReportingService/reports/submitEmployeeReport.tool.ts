import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  report_type_id: z
    .number()
    .int()
    .describe(
      "Report type id (m_report_types.id). Pass -1 for an ad-hoc report not tied to a recurring type.",
    ),
  report_title: z
    .string()
    .trim()
    .min(1)
    .describe("Report title (required, non-empty)."),
  report_content: z
    .string()
    .trim()
    .min(1)
    .describe(
      "HTML or Markdown body of the report (required). Backend stores it verbatim.",
    ),
  attachments: z
    .array(z.unknown())
    .optional()
    .describe("Optional array of attachment metadata objects."),
  is_draft: z
    .boolean()
    .default(false)
    .describe(
      "Save as draft (true) or submit (false). Drafts skip notifications and leave submitted_at null.",
    ),
  status: z
    .number()
    .int()
    .optional()
    .describe(
      "Optional status code. Backend definition controls meaning (typical: 1=submitted, 2=deleted).",
    ),
  shows_to: z
    .array(z.number().int().positive())
    .optional()
    .describe(
      "Optional list of user_ids this report is visible to. Required ONLY when report_type_id == -1; otherwise the backend derives from the type's configuration.",
    ),
  due_date: z
    .string()
    .optional()
    .describe(
      "Optional due/effective date as ISO string. Backend stores it as report_date.",
    ),
});

interface SubmitEmployeeReportResult {
  success: boolean;
  is_draft: boolean;
  message: string;
}

interface BackendMessage {
  message?: unknown;
}

export const submitEmployeeReportTool: ToolDefinition<
  typeof schema,
  SubmitEmployeeReportResult
> = {
  name: "submit_employee_report",
  title: "Submit (or save as draft) an employee report",
  description:
    "Creates a new entry in the caller's employee-reporting log. Required: `report_type_id`, " +
    "`report_title`, `report_content`. Optional: `attachments`, `is_draft`, `status`, " +
    "`shows_to` (only when report_type_id is -1 / ad-hoc), `due_date`." +
    "\n\nUNDERSTANDING THE FLOW: Append-only — never edits an existing report. The backend " +
    "validates the report_type and the caller's department/designation against the type's " +
    "permissions, derives `shows_to` from the type when not ad-hoc, stamps the calling user " +
    "as `user_id`, sets `submitted_at = now()` unless `is_draft = true`, and sends " +
    "notification emails to recipients. company_id / company_type are auto-injected and the " +
    "backend re-resolves them from the user record." +
    "\n\nUSE THIS TOOL TO: file a daily report, submit a weekly summary, or save an in-progress " +
    "draft." +
    "\n\nNOTE: To save a generic template after submission use `create_report_template`. To " +
    "comment on someone else's report use `add_report_comment`. The backend returns only a " +
    "string status — there is no report_id in the response.",
  inputSchema: schema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  meta: { version: "1.0.0", tags: ["action", "ers", "reports", "create"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      report_type_id: input.report_type_id,
      report_title: input.report_title,
      report_content: input.report_content,
      is_draft: input.is_draft,
    };
    if (input.attachments !== undefined)
      body["attachments"] = input.attachments;
    if (input.status !== undefined) body["status"] = input.status;
    if (input.shows_to !== undefined) body["shows_to"] = input.shows_to;
    if (input.due_date !== undefined) body["due_date"] = input.due_date;

    const res = await apiPost<BackendMessage>(
      `${SERVICE.ERS}/reports/createReport`,
      body,
      ctx,
      {
        injectCompanyContext: false,
      },
    );

    const messageText =
      typeof res?.message === "string"
        ? res.message
        : `Report ${input.is_draft ? "saved as draft" : "submitted"} successfully!`;

    return {
      success: true,
      is_draft: input.is_draft,
      message: messageText,
    };
  },
};

toolRegistry.register(submitEmployeeReportTool);
