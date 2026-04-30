import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .describe(
      "Optional period start (YYYY-MM-DD). When omitted the backend computes for the current calendar month.",
    ),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .describe(
      "Optional period end (YYYY-MM-DD). When omitted the backend computes for the current calendar month.",
    ),
});

interface DepartmentStat {
  departmentId: number;
  departmentName: string;
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  percentageOfTotal: string;
}

interface DesignationStat {
  designationId: number;
  designationName: string;
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  percentageOfTotal: string;
}

interface EmployeeDetail {
  esslId: string;
  employeeId: string;
  employeeName: string;
  profilePic: string | null;
  designation: string;
  department: string;
  reportingOfficer: string;
  dateOfJoining: string;
  tenure: string;
  tenureStatus: string;
  employeeStatus: string;
  gender: string;
  email: string;
  phone: string;
  officialPhone: string;
  workFrom: string;
  biometricEnabled: string;
}

interface GenderBreakdown {
  male: number;
  female: number;
  other: number;
  previous?: { male: number; female: number; other: number };
}

interface StatCard {
  title: string;
  value: number;
  change: string;
  trend: "up" | "down";
  icon: string;
  description: string;
  variant: string;
  valueFormat: string;
  genderBreakdown?: GenderBreakdown;
}

interface MonthlyAttritionRow {
  month: string;
  openingHC: number;
  newJoiners: number;
  totalExits: number;
  closingHC: number;
  attritionPercentage: string;
}

interface EmployeeStatisticsResult {
  company_id: number;
  company_type: string;
  company_name: string;
  statistics: {
    raw: {
      current: Record<string, unknown>;
      previous: Record<string, unknown>;
    };
    cards: {
      totalEmployees: StatCard;
      activeEmployees: StatCard;
      newJoiners: StatCard;
      inactiveEmployees: StatCard;
      femaleEmployees: StatCard;
      maleEmployees: StatCard;
      otherGender: StatCard;
    };
  };
  department_statistics: {
    department_count: number;
    departments: DepartmentStat[];
    total_employees_by_department: number;
  };
  designation_statistics: {
    designation_count: number;
    designations: DesignationStat[];
    total_employees_by_designation: number;
  };
  employee_details: {
    total_records: number;
    employees: EmployeeDetail[];
  };
  monthly_attrition: {
    current_year: MonthlyAttritionRow[];
    previous_year: MonthlyAttritionRow[];
    summary: {
      averageAttrition: string;
      totalNewJoiners: number;
      totalExits: number;
      netGrowth: number;
    };
  };
  period_info: {
    current_period: { start: string; end: string };
    comparison_period: { start: string; end: string };
  };
}

interface StatsResponse {
  data: {
    data: {
      companyId?: number;
      companyType?: string;
      companyName?: string;
      statistics?: {
        raw?: {
          current?: Record<string, unknown>;
          previous?: Record<string, unknown>;
        };
        cards?: Record<string, unknown>;
      };
      departmentStatistics?: {
        departmentCount?: number;
        departments?: DepartmentStat[];
        totalEmployeesByDepartment?: number;
      };
      designationStatistics?: {
        designationCount?: number;
        designations?: DesignationStat[];
        totalEmployeesByDesignation?: number;
      };
      employeeDetails?: {
        totalRecords?: number;
        employees?: EmployeeDetail[];
      };
      monthlyAttrition?: {
        currentYear?: MonthlyAttritionRow[];
        previousYear?: MonthlyAttritionRow[];
        summary?: {
          averageAttrition?: string;
          totalNewJoiners?: number;
          totalExits?: number;
          netGrowth?: number;
        };
      };
      periodInfo?: {
        currentPeriod?: { start?: string; end?: string };
        comparisonPeriod?: { start?: string; end?: string };
      };
    };
  };
}

export const getEmployeeStatisticsTool: ToolDefinition<
  typeof schema,
  EmployeeStatisticsResult
> = {
  name: "get_employee_statistics",
  title:
    "HR analytics — headcount, hiring, attrition, gender split, dept/designation distribution",
  description:
    "Returns the same employee-statistics payload that powers the frontend Analytics dashboard. " +
    "Includes for the current calendar month and the previous month: total / active / inactive " +
    "headcount, new joiners (overall + by gender), male/female/other gender splits (overall, " +
    "active-only, inactive-only, new-joiner-only), and computed period-over-period change %. " +
    "Also returns department-wise and designation-wise distribution (with per-dept headcount and " +
    "% of total), full employee detail roster (designation, dept, manager, tenure, gender, contact, " +
    "work-from mode, biometric status), and 12-month rolling attrition trend for both current and " +
    "previous year (opening HC, new joiners, exits, closing HC, attrition %). " +
    "\n\nUSE THIS TOOL TO: answer 'how many employees do we have', report headcount changes, " +
    "show gender split, summarise hiring/attrition for the month, list all employees with their " +
    "manager and tenure, or feed an executive HR dashboard. Optional start_date / end_date narrow " +
    "the comparison period. " +
    "\n\nNOTE: Excludes Admin role users from all counts (backend filter). For a single employee's " +
    "full profile use get_employee_by_id; this tool is for aggregate analytics + bulk roster.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: {
    version: "2.0.0",
    tags: [
      "users",
      "analytics",
      "headcount",
      "attrition",
      "hiring",
      "dashboard",
    ],
  },

  handler: async (input, ctx) => {
    const auth = ctx.sessionAuth;
    if (!auth) {
      throw new Error(
        "[AUTH_ERROR] Session credentials not available. Please re-initialize the MCP session.",
      );
    }

    const body: Record<string, unknown> = {
      companyId: auth.companyId,
      companyType: auth.companyType,
    };

    if (input.start_date || input.end_date) {
      body["filters"] = {
        date_range: {
          ...(input.start_date ? { start_date: input.start_date } : {}),
          ...(input.end_date ? { end_date: input.end_date } : {}),
        },
      };
    }

    const res = await apiPost<StatsResponse>(
      `${SERVICE.USERS}/getEmployeeStatisticsAndDetails`,
      body,
      ctx,
      { injectCompanyContext: false },
    );

    const d = res?.data?.data ?? {};

    return {
      company_id: d.companyId ?? 0,
      company_type: d.companyType ?? "",
      company_name: d.companyName ?? "",
      statistics: {
        raw: {
          current: d.statistics?.raw?.current ?? {},
          previous: d.statistics?.raw?.previous ?? {},
        },
        cards: (d.statistics?.cards ??
          {}) as EmployeeStatisticsResult["statistics"]["cards"],
      },
      department_statistics: {
        department_count: d.departmentStatistics?.departmentCount ?? 0,
        departments: d.departmentStatistics?.departments ?? [],
        total_employees_by_department:
          d.departmentStatistics?.totalEmployeesByDepartment ?? 0,
      },
      designation_statistics: {
        designation_count: d.designationStatistics?.designationCount ?? 0,
        designations: d.designationStatistics?.designations ?? [],
        total_employees_by_designation:
          d.designationStatistics?.totalEmployeesByDesignation ?? 0,
      },
      employee_details: {
        total_records: d.employeeDetails?.totalRecords ?? 0,
        employees: d.employeeDetails?.employees ?? [],
      },
      monthly_attrition: {
        current_year: d.monthlyAttrition?.currentYear ?? [],
        previous_year: d.monthlyAttrition?.previousYear ?? [],
        summary: {
          averageAttrition:
            d.monthlyAttrition?.summary?.averageAttrition ?? "0.00%",
          totalNewJoiners: d.monthlyAttrition?.summary?.totalNewJoiners ?? 0,
          totalExits: d.monthlyAttrition?.summary?.totalExits ?? 0,
          netGrowth: d.monthlyAttrition?.summary?.netGrowth ?? 0,
        },
      },
      period_info: {
        current_period: {
          start: d.periodInfo?.currentPeriod?.start ?? "",
          end: d.periodInfo?.currentPeriod?.end ?? "",
        },
        comparison_period: {
          start: d.periodInfo?.comparisonPeriod?.start ?? "",
          end: d.periodInfo?.comparisonPeriod?.end ?? "",
        },
      },
    };
  },
};

toolRegistry.register(getEmployeeStatisticsTool);
