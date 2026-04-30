import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  user_id: z
    .number()
    .int()
    .positive()
    .describe(
      "Employee user_id to fetch the full profile for. Use list_employees to discover IDs.",
    ),
});

interface EmployeeDetails {
  user_id: number;
  emp_id: string;
  employee_id: string;
  name: string;
  email: string;
  role: string;
  role_char: string;
  department: string;
  designation: string;
  status: string;
  joining_date: string | null;
  date_of_birth: string | null;
  gender: string | null;
  profile_pic_url: string | null;
  mobile: string;
  official_phone: string;
  reporting_officer: {
    id: number | null;
    name: string;
    profile_pic_url: string | null;
  };
  responsibilities: unknown;
  company_id: number | null;
  company_type: string | null;
}

interface EmployeeByIdRecord {
  key?: number;
  EmpID?: string;
  Employee_ID?: string;
  Image?: string | null;
  Name?: string;
  Role?: string;
  role_char?: string;
  Email?: string;
  Department?: string;
  Phone?: string;
  Official_Phone?: string;
  JoiningDate?: string | null;
  DOB?: string | null;
  Gender?: string | null;
  Status?: string;
  ReportingOfficerId?: number | null;
  ReportingOfficerName?: string;
  ReportingOfficerPic?: string | null;
  company_id?: number | null;
  company_type?: string | null;
  responsibilities?: unknown;
}

interface EmployeeByIdResponse {
  data: {
    data: EmployeeByIdRecord;
  };
}

export const getEmployeeByIdTool: ToolDefinition<typeof schema, EmployeeDetails> = {
  name: "get_employee_by_id",
  title:
    "Get a single employee's full profile by user_id — name, contact, role, manager, dates & demographics",
  description:
    "Returns the complete profile of ONE employee resolved by user_id. The payload mirrors the " +
    "frontend Employee Detail page. Returned fields: full name, employee code (EmpID and " +
    "Employee_ID), email, primary mobile (formatted as country-code + number), official phone, " +
    "profile picture URL, role / designation, department, employment status (Active / Inactive), " +
    "date of joining (DOJ), date of birth (DOB), gender, role_char (e.g. EMPLOYEE / ADMIN / " +
    "MANAGER), free-form responsibilities text, and the reporting officer block (id, name, " +
    "profile picture). Also returns the employee's company_id and company_type." +
    "\n\nUSE THIS TOOL TO:" +
    "\n• Answer 'who is user #123' or 'show me <person>'s profile' once the user_id is known" +
    "\n• Look up a manager / reporting officer before drafting an approval, escalation, or notification" +
    "\n• Verify someone is currently active before assigning work, leave, or assets to them" +
    "\n• Pull DOB / DOJ for birthday or work-anniversary context (also see list_public_calendar_events)" +
    "\n• Fetch a phone or email when the user asks how to contact someone" +
    "\n• Surface a profile picture URL for avatar rendering" +
    "\n\nNOTE:" +
    "\n• Point lookup only (one user_id per call). For many employees in one call use list_employees " +
    "with a search/department filter, or list_designations_with_user_count for role-grouped lists." +
    "\n• If only a name or email is known, call list_employees first to discover the user_id." +
    "\n• mobile and official_phone come pre-formatted with country-code prefixes — pass through " +
    "verbatim, do not split or re-format unless asked." +
    "\n• DOB, DOJ and date_of_leaving are strings in the backend's stored format (typically " +
    "YYYY-MM-DD or ISO) — echo through unchanged when surfacing to the user." +
    "\n• Personal data (DOB, mobile, gender, address) is sensitive PII — only surface it when the " +
    "user has clearly asked for it." +
    "\n• Strictly company-scoped via session auth; cross-tenant lookups are rejected.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["users", "employee", "lookup", "profile"] },

  handler: async (input, ctx) => {
    const res = await apiPost<EmployeeByIdResponse>(
      `${SERVICE.USERS}/getEmployeeById`,
      { id: input.user_id },
      ctx,
      { injectCompanyContext: false },
    );

    const r = res?.data?.data ?? ({} as EmployeeByIdRecord);

    return {
      user_id: r.key ?? input.user_id,
      emp_id: r.EmpID ?? "",
      employee_id: r.Employee_ID ?? "",
      name: r.Name ?? "Unknown",
      email: r.Email ?? "",
      role: r.Role ?? "",
      role_char: r.role_char ?? "",
      department: r.Department ?? "Unassigned",
      designation: r.Role ?? "Unassigned",
      status: r.Status ?? "Active",
      joining_date: r.JoiningDate ?? null,
      date_of_birth: r.DOB ?? null,
      gender: r.Gender ?? null,
      profile_pic_url: r.Image ?? null,
      mobile: r.Phone ?? "",
      official_phone: r.Official_Phone ?? "",
      reporting_officer: {
        id: r.ReportingOfficerId ?? null,
        name: (r.ReportingOfficerName ?? "").trim(),
        profile_pic_url: r.ReportingOfficerPic ?? null,
      },
      responsibilities: r.responsibilities ?? null,
      company_id: r.company_id ?? null,
      company_type: r.company_type ?? null,
    };
  },
};

toolRegistry.register(getEmployeeByIdTool);
