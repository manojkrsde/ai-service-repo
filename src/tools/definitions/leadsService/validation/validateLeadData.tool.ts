/**
 * Answers: "Is this lead data valid / complete before I create or update it?"
 *
 * Client-side validation only — no backend call unless a phone duplicate
 * check is requested. Returns a structured report of which fields pass,
 * which are missing, and which are malformed.
 */
import { z } from "zod";

import { leadsPost } from "../../../../helpers/leads.client.js";
import { normalizePhone } from "../../../../helpers/phone.helper.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  name: z.string().optional().describe("Lead's full name to validate"),
  email: z.string().optional().describe("Email address to validate"),
  phone: z.string().optional().describe("Phone number to validate and normalise"),
  check_phone_duplicate: z
    .boolean()
    .default(false)
    .describe(
      "If true, also call the backend to check whether this phone already has a lead",
    ),
});

interface FieldResult {
  field: string;
  value: string | null;
  valid: boolean;
  issues: string[];
}

interface ValidateLeadDataResult {
  overall_valid: boolean;
  fields: FieldResult[];
  phone_normalized: { digits: string; last10: string } | null;
  duplicate_check: { checked: boolean; exists: boolean; match_count: number } | null;
}

interface DuplicateResponse {
  data?: unknown[] | unknown | null;
}

function collectCount(res: DuplicateResponse): number {
  if (!res.data) return 0;
  if (Array.isArray(res.data)) return res.data.length;
  return 1;
}

export const validateLeadDataTool: ToolDefinition<
  typeof schema,
  ValidateLeadDataResult
> = {
  name: "validate_lead_data",
  title: "Validate Lead Data",
  description:
    "Validates lead fields (name, email, phone) before creation or update. " +
    "Normalises the phone number and optionally checks for a phone duplicate. " +
    "Use when the user asks: Is this data valid? Can I create a lead with these details?",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leads", "validation"] },

  handler: async (input, ctx) => {
    const fields: FieldResult[] = [];
    let overallValid = true;

    // Name
    if (input.name !== undefined) {
      const issues: string[] = [];
      const trimmed = input.name.trim();
      if (trimmed.length === 0) issues.push("Name is empty");
      else if (trimmed.length < 2) issues.push("Name is too short (minimum 2 characters)");
      const ok = issues.length === 0;
      if (!ok) overallValid = false;
      fields.push({ field: "name", value: trimmed || null, valid: ok, issues });
    }

    // Email
    if (input.email !== undefined) {
      const issues: string[] = [];
      const trimmed = input.email.trim().toLowerCase();
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(trimmed)) issues.push("Email format is invalid");
      const ok = issues.length === 0;
      if (!ok) overallValid = false;
      fields.push({ field: "email", value: trimmed || null, valid: ok, issues });
    }

    // Phone
    let phoneNorm: { digits: string; last10: string } | null = null;
    if (input.phone !== undefined) {
      const issues: string[] = [];
      const norm = normalizePhone(input.phone);
      phoneNorm = { digits: norm.digits, last10: norm.last10 };
      if (norm.digits.length < 7) issues.push("Phone number is too short after stripping non-digits");
      if (norm.digits.length > 15) issues.push("Phone number is too long (E.164 max is 15 digits)");
      const ok = issues.length === 0;
      if (!ok) overallValid = false;
      fields.push({ field: "phone", value: norm.last10 || norm.digits || null, valid: ok, issues });
    }

    // Optional duplicate check
    let dupCheck: { checked: boolean; exists: boolean; match_count: number } | null = null;
    if (input.check_phone_duplicate && phoneNorm) {
      try {
        const key = phoneNorm.last10 || phoneNorm.digits;
        const res = await leadsPost<DuplicateResponse>(
          "/checkDuplcateLeadByNumber",
          { mobile_no: key },
          ctx,
        );
        const count = collectCount(res);
        dupCheck = { checked: true, exists: count > 0, match_count: count };
      } catch {
        dupCheck = { checked: false, exists: false, match_count: 0 };
      }
    }

    return {
      overall_valid: overallValid,
      fields,
      phone_normalized: phoneNorm,
      duplicate_check: dupCheck,
    };
  },
};

toolRegistry.register(validateLeadDataTool);
