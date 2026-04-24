/**
 * Manually creates a new lead by submitting form field data.
 *
 * Calls POST /addLeadRespone (backend route spelling — the 's' is missing).
 * Middleware requires signature + company_id + company_type + form_id +
 * lead_source + priority + assigned_lead_type + response, so default company
 * injection is used. The backend resolves pipeline_id internally from form_id;
 * it also rejects duplicates by mobile number and requires response["Mobile No"].
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  form_id: z
    .number()
    .int()
    .positive()
    .describe(
      "Lead form ID to submit against. Use list_forms to discover available forms.",
    ),
  fields: z
    .record(z.string(), z.unknown())
    .describe(
      "Form field values keyed by form field name. MUST include 'Mobile No' (required by backend); 'Full Name' and 'Email' are strongly recommended. Example: { 'Full Name': 'John Doe', 'Mobile No': '9876543210', 'Email': 'j@x.com' }",
    ),
  priority: z
    .enum(["Low", "Medium", "High", "Urgent"])
    .default("Medium")
    .describe("Initial priority for the new lead"),
  source: z
    .string()
    .trim()
    .min(1)
    .default("manual")
    .describe(
      "Top-level lead source, e.g. 'manual', 'referral', 'website', 'whatsapp'",
    ),
  source_child: z
    .string()
    .optional()
    .describe("Optional sub-source (child source) for finer attribution"),
  pipeline: z
    .string()
    .optional()
    .describe(
      "Starting pipeline stage name. Defaults to the first stage of the form's pipeline. Must match a stage in the form's pipeline exactly (case-sensitive).",
    ),
  assignment: z
    .enum(["auto", "manual"])
    .default("manual")
    .describe(
      "'auto' runs the backend's round-robin auto-assignment against the form's eligible employees; 'manual' leaves the lead unassigned unless assigned_to is also provided.",
    ),
  assigned_to: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Optional user ID to pre-assign the new lead to (only used when assignment is 'manual'). Use list_employees to resolve names to IDs.",
    ),
});

interface CreateLeadResult {
  success: boolean;
  form_id: number;
  message: string;
}

interface BackendMessageItem {
  msg?: string;
  message?: string;
  status?: boolean;
}

interface AddLeadEnvelope {
  message?: BackendMessageItem[] | BackendMessageItem;
}

function extractMessage(res: AddLeadEnvelope | undefined): string {
  const m = res?.message;
  if (Array.isArray(m)) {
    return m[0]?.msg ?? m[0]?.message ?? "";
  }
  if (m && typeof m === "object") {
    return m.msg ?? m.message ?? "";
  }
  return "";
}

export const createLeadTool: ToolDefinition<typeof schema, CreateLeadResult> = {
  name: "create_lead",
  title: "Create lead — submit a new lead via a capture form",
  description:
    "Creates a new lead by submitting form field values against an existing lead form. " +
    "Under the hood the backend resolves the form's pipeline, validates uniqueness by " +
    "mobile number (rejects duplicates), writes the lead into the queue (or directly " +
    "assigns per the 'assignment' argument), and triggers a WhatsApp welcome based on the " +
    "starting stage. " +
    "\n\nUNDERSTANDING THE FLOW: 'fields' is stored as one JSON blob on the lead; the " +
    "backend derives name/email/mobile_no columns from the keys 'Full Name', 'Email', and " +
    "'Mobile No'. If 'Mobile No' is missing the call is rejected. If a lead with the same " +
    "Mobile No already exists for this company + form, the backend refuses with a duplicate " +
    "error naming the current owner (or the queue) — re-try only after resolving the duplicate. " +
    "\n\nUSE THIS TOOL TO: add a lead that came in via phone, email, or any off-system " +
    "channel; pre-assign it to a specific salesperson via `assignment: 'manual'` + " +
    "`assigned_to`; or drop it into the auto-assign round-robin via `assignment: 'auto'`. " +
    "\n\nNOTE: Call list_forms first to discover valid form IDs and their field names. The " +
    "backend does not return the new lead's internal ID in the response body; if you need " +
    "the new lead's ID, follow up with list_leads or list_unassigned_leads filtered to the " +
    "same form and mobile number.",
  inputSchema: schema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  meta: { version: "2.0.0", tags: ["action", "leads"] },

  handler: async (input, ctx) => {
    const mobile = input.fields["Mobile No"];
    if (mobile === undefined || mobile === null || mobile === "") {
      throw new Error(
        "[VALIDATION] fields['Mobile No'] is required — the backend rejects leads without a mobile number.",
      );
    }

    const body: Record<string, unknown> = {
      form_id: input.form_id,
      response: input.fields,
      lead_source: input.source,
      priority: input.priority,
      assigned_lead_type: input.assignment === "auto" ? "Automatic" : "Manual",
    };

    if (input.source_child !== undefined) {
      body["lead_source_child"] = input.source_child;
    }
    if (input.pipeline !== undefined) {
      body["pipeline"] = input.pipeline;
    }
    if (input.assigned_to !== undefined) {
      body["assigned_to"] = input.assigned_to;
    }

    const res = await apiPost<AddLeadEnvelope>(
      `${SERVICE.LEADS}/addLeadRespone`,
      body,
      ctx,
    );

    return {
      success: true,
      form_id: input.form_id,
      message: extractMessage(res) || "Lead added successfully",
    };
  },
};

toolRegistry.register(createLeadTool);
