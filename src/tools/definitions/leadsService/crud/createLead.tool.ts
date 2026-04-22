// AUDIT (v1):
// - Verdict: DEFER (v2)
// - Out of v1 scope: v1 focuses on information retrieval + low-risk
//   additive mutations only. Creating new lead records is deferred.
// - No changes in v1 — existing behavior preserved.

/**
 * Manually creates a new lead by submitting form data.
 *
 * IMPORTANT: The backend route has a typo — it is POST /addLeadRespone
 * (missing the 's') — this is the actual registered route in lead_routes.js.
 *
 * Fetches the form definition first to resolve pipeline_id, then calls
 * /addLeadRespone with all required fields.
 */
import { z } from "zod";

import { leadsPost } from "../../../../helpers/leads.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  form_id: z
    .number()
    .int()
    .positive()
    .describe(
      "The ID of the lead capture form to submit against. " +
        "Use list_forms to discover available forms.",
    ),
  fields: z
    .record(z.string(), z.unknown())
    .describe(
      "Key-value map of form field data, e.g. { name: 'John Doe', phone: '9876543210', email: 'j@example.com' }",
    ),
  priority: z
    .enum(["low", "medium", "high", "urgent"])
    .default("low")
    .describe("Initial priority for the lead"),
  source: z
    .string()
    .default("manual")
    .describe("Lead source identifier, e.g. manual, referral, website"),
});

interface CreateLeadResult {
  success: boolean;
  lead_id: number | null;
  form_id: number;
  pipeline_id: number;
}

interface FormRecord {
  id?: number;
  pipeline_id?: number;
}

interface EditFormResponse {
  data?: FormRecord;
}

interface AddLeadResponse {
  success?: boolean;
  data?: { id?: number };
  id?: number;
}

export const createLeadTool: ToolDefinition<typeof schema, CreateLeadResult> =
  {
    name: "create_lead",
    title: "Create Lead",
    description:
      "Manually creates a new lead by submitting form field data. " +
      "The 'fields' map must include at least: 'Full Name' and 'Mobile No' " +
      "(these are the keys the backend validates). " +
      "Use list_forms first to discover available forms and their required fields. " +
      "Always run check_duplicate_phone before creating a lead to avoid duplicates. " +
      "Use this to add a lead that came via phone, email, or any off-system channel.",
    inputSchema: schema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    meta: { version: "1.0.0", tags: ["action", "leads"] },

    handler: async (input, ctx) => {
      // Fetch the form to get the pipeline_id required by /addLeadResponse
      const formRes = await leadsPost<EditFormResponse>(
        "/editLeadForm",
        { form_id: input.form_id },
        ctx,
      );

      const form = formRes.data;
      if (!form) {
        throw new Error(`Form ${input.form_id} not found`);
      }

      const pipelineId = form.pipeline_id;
      if (!pipelineId) {
        throw new Error(`Form ${input.form_id} has no associated pipeline`);
      }

      const res = await leadsPost<AddLeadResponse>(
        // Backend route has typo: /addLeadRespone (not /addLeadResponse)
        "/addLeadRespone",
        {
          form_id: input.form_id,
          pipeline_id: pipelineId,
          response: input.fields,
          priority: input.priority,
          lead_source: input.source,
        },
        ctx,
      );

      const leadId = res.data?.id ?? res.id ?? null;

      return {
        success: true,
        lead_id: leadId !== undefined ? leadId : null,
        form_id: input.form_id,
        pipeline_id: pipelineId,
      };
    },
  };

toolRegistry.register(createLeadTool);
