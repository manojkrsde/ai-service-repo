/**
 * Checks whether a phone number already has a lead in the tenant.
 *
 * Wraps POST /checkDuplcateLeadByNumber (backend route spelling).
 * Middleware is strict: signature + mobile_number (NUMBER, required).
 * Therefore company context is suppressed and the phone is coerced to a
 * positive integer before sending.
 *
 * Response is custom_message-wrapped:
 *   { message: { isDuplicate: bool, message: string, status: bool } }
 * — there is no leads array, just the verdict + a human-readable message
 * that names the current owner (or notes 'unassigned in queue').
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import { normalizePhone } from "../../../../helpers/phone.helper.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  phone: z
    .string()
    .min(3)
    .describe(
      "Phone number in any format. Tool normalises (strips +, spaces, hyphens) and sends the digits.",
    ),
});

interface DuplicateCheckResult {
  query: string;
  normalized: { digits: string; last10: string };
  is_duplicate: boolean;
  message: string;
}

interface DuplicateBody {
  isDuplicate?: boolean;
  message?: string;
  status?: boolean;
}

interface DuplicateResponse {
  message?: DuplicateBody;
}

export const checkDuplicatePhoneTool: ToolDefinition<
  typeof schema,
  DuplicateCheckResult
> = {
  name: "check_duplicate_phone",
  title:
    "Check duplicate phone — does this number already exist as a lead anywhere?",
  description:
    "Asks the backend whether the given phone number is already attached to any lead in the " +
    "tenant. Returns a boolean verdict (`is_duplicate`) plus the backend's human-readable " +
    "message — which names the current assignee + creation date, or notes that the duplicate " +
    "lead is unassigned in the queue. " +
    "\n\nUNDERSTANDING THE FLOW: This is a tenant-wide check (not form-scoped); duplicate " +
    "detection here is a global lookup by mobile_no across all leads. Backend matches on " +
    "exact mobile_no via case-insensitive ILIKE — the tool sends the longest digit run from " +
    "the input. " +
    "\n\nUSE THIS TOOL TO: pre-flight a create_lead call (which the backend will reject with " +
    "a duplicate error otherwise), or answer 'do we already have a lead for this number?'. " +
    "\n\nNOTE: Backend response does NOT include the duplicate lead's record — only the " +
    "verdict + message. To inspect the actual duplicate lead, call list_lead_history with " +
    "search_term set to the same number, or list_leads filtered by user_id once you know who " +
    "owns it.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "2.0.0", tags: ["leads", "duplicate-check"] },

  handler: async (input, ctx) => {
    const normalized = normalizePhone(input.phone);
    const digits = normalized.last10 || normalized.digits;

    if (!digits || digits.length === 0 || !/^\d+$/.test(digits)) {
      throw new Error(
        "[VALIDATION] phone must contain at least one digit after normalisation",
      );
    }

    const res = await apiPost<DuplicateResponse>(
      `${SERVICE.LEADS}/checkDuplcateLeadByNumber`,
      { mobile_number: `${digits}` },
      ctx,
      { injectCompanyContext: false },
    );

    const body = res.message ?? {};

    return {
      query: input.phone,
      normalized: { digits: normalized.digits, last10: normalized.last10 },
      is_duplicate: body.isDuplicate === true,
      message:
        body.message ??
        (body.isDuplicate ? "Duplicate lead exists" : "No duplicate found"),
    };
  },
};

toolRegistry.register(checkDuplicatePhoneTool);
