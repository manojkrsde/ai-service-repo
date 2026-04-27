/**
 * Shared utilities for lead tool handlers.
 */

interface LeadLike {
  email?: string;
  mobile_no?: string;
  response?: Record<string, unknown>;
}

/**
 * Extracts the best available display name from a lead record.
 *
 * Checks common response keys (name, full_name, fullName, customer_name)
 * and falls back to email, phone, or "Unknown".
 */
export function extractLeadName(lead: LeadLike): string {
  const r = lead.response ?? {};
  const name =
    r["name"] ?? r["full_name"] ?? r["fullName"] ?? r["customer_name"];
  if (typeof name === "string" && name.trim()) return name.trim();
  return lead.email ?? lead.mobile_no ?? "Unknown";
}
