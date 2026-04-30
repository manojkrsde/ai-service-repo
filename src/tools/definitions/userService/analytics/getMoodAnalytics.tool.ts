import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  question_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      "Filter analytics to a single mood-survey question. Omit for all questions combined.",
    ),
  department_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Restrict to one department. Omit for company-wide aggregation."),
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .describe("Period start (YYYY-MM-DD). Optional."),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .describe("Period end (YYYY-MM-DD). Optional."),
});

interface MoodAnalyticsResult {
  data: unknown;
}

interface MoodAnalyticsResponse {
  message: {
    data: unknown;
  };
}

export const getMoodAnalyticsTool: ToolDefinition<
  typeof schema,
  MoodAnalyticsResult
> = {
  name: "get_mood_analytics",
  title:
    "Employee engagement analytics — mood distribution, trend & participation by department",
  description:
    "Returns aggregated mood / engagement analytics from the daily mood-meter surveys: response " +
    "distribution (positive / neutral / negative), participation %, trend over time, and a " +
    "department-level breakdown. The exact shape mirrors what the frontend Analytics > Mood " +
    "panel renders. " +
    "\n\nUSE THIS TOOL TO: answer 'how is team morale?', surface mood dips week-over-week, compare " +
    "engagement between departments, or feed a leadership engagement summary. Optional filters: " +
    "question_id (single question), department_id (single dept), and start_date / end_date " +
    "(YYYY-MM-DD). " +
    "\n\nNOTE: Aggregated only — never returns individual responses. Some companies may not have " +
    "the mood-meter feature enabled; in that case the data block will be empty.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: {
    version: "1.0.0",
    tags: ["mood", "engagement", "analytics", "dashboard"],
  },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {};
    if (input.question_id !== undefined)
      body["question_id"] = input.question_id;
    if (input.department_id !== undefined)
      body["department_id"] = input.department_id;
    if (input.start_date) body["start_date"] = input.start_date;
    if (input.end_date) body["end_date"] = input.end_date;

    const res = await apiPost<MoodAnalyticsResponse>(
      `${SERVICE.USERS}/getMoodAnalytics`,
      body,
      ctx,
    );

    const data = res?.message;

    return { data: data?.data ?? null };
  },
};

toolRegistry.register(getMoodAnalyticsTool);
