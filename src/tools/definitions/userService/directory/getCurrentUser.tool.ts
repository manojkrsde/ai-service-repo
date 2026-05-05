import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

/**
 * Empty schema — the tool requires no input.
 * The logged-in user's identity is resolved entirely from the session context.
 */
const schema = z.object({});

interface CurrentUserProfile {
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
  Designation?: string;
}

interface EmployeeByIdResponse {
  data: {
    data: EmployeeByIdRecord;
  };
}

export const getCurrentUserTool: ToolDefinition<
  typeof schema,
  CurrentUserProfile
> = {
  name: "get_current_user",
  aliases: ["whoami", "my_profile"],
  title:
    "Get the currently logged-in user's full profile — name, contact, role, department & more",
  description:
    "Returns the complete profile of the user whose session is active (the person chatting). " +
    "Requires NO input — the identity is resolved automatically from the authenticated session." +
    "\n\nReturned fields: full name, employee codes (EmpID / Employee_ID), email, mobile, " +
    "official phone, profile picture URL, role / designation, department, employment status, " +
    "date of joining, date of birth, gender, role_char, responsibilities, reporting officer " +
    "(id, name, picture), company_id and company_type." +
    "\n\nUSE THIS TOOL TO:" +
    "\n• Answer 'who am I?', 'what is my profile?', 'show my details'" +
    "\n• Confirm the logged-in user's identity, role, or department" +
    "\n• Look up the current user's reporting officer or contact details" +
    "\n• Retrieve the current user's employee code, joining date, or other HR fields" +
    "\n• Provide context about the active user before performing actions on their behalf" +
    "\n\nNOTE:" +
    "\n• This is always the FIRST tool to try when the user asks about themselves." +
    "\n• No input parameters needed — the session provides the user_id automatically." +
    "\n• For OTHER employees, use get_employee_by_id or list_employees instead.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: {
    version: "1.0.0",
    tags: ["users", "profile", "self", "whoami", "current-user"],
  },

  handler: async (_input, ctx) => {
    if (!ctx.userId) {
      throw new Error(
        "[AUTH_ERROR] User ID not available in the session. Please re-authenticate.",
      );
    }

    const res = await apiPost<EmployeeByIdResponse>(
      `${SERVICE.USERS}/getEmployeeById`,
      { id: ctx.userId },
      ctx,
      { injectCompanyContext: false },
    );

    const r = res?.data?.data ?? ({} as EmployeeByIdRecord);

    return {
      user_id: r.key ?? ctx.userId,
      emp_id: r.EmpID ?? "",
      employee_id: r.Employee_ID ?? "",
      name: r.Name ?? "Unknown",
      email: r.Email ?? ctx.sessionAuth?.email ?? "",
      role: r.Role ?? "",
      role_char: r.role_char ?? ctx.sessionAuth?.role ?? "",
      department: r.Department ?? "Unassigned",
      designation: r.Designation ?? r.Role ?? "Unassigned",
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
      company_id: r.company_id ?? ctx.sessionAuth?.companyId ?? null,
      company_type: r.company_type ?? ctx.sessionAuth?.companyType ?? null,
    };
  },
};

toolRegistry.register(getCurrentUserTool);
