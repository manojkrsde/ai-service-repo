/**
 * Answers: "Tell me about lead 123 — full profile with notes, calls, and activity."
 *
 * Fans out to /getLeadById (+ optionally /getLeadNote, /getLeadCalls,
 * /getLeadActivities). Per backend middleware: /getLeadById and
 * /getLeadActivities accept only signature + lead_id, so company context is
 * suppressed for those calls. /getLeadNote and /getLeadCalls require
 * company_id + company_type, so the default inject is used.
 */
import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  lead_id: z
    .number()
    .int()
    .positive()
    .describe("The internal CRM ID of the lead to retrieve"),
  include: z
    .array(z.enum(["notes", "calls", "activities"]))
    .default(["notes", "calls", "activities"])
    .describe(
      "Which related blocks to include alongside the lead record (all three by default)",
    ),
});

interface LeadProfile {
  lead_id: number;
  form_id: number | null;
  pipeline_id: number | null;
  pipeline_stage: string;
  priority: string;
  source: string;
  source_child: string | null;
  name: string;
  phone: string;
  email: string;
  assigned_to: number | null;
  assigned_to_name: string | null;
  assigned_to_image: string | null;
  follow_up_date: string | null;
  company_id: number | null;
  company_type: string | null;
  response: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface NoteEntry {
  id: number;
  title: string | null;
  text: string | null;
  files: unknown[];
  conversations: unknown[];
  date: string | null;
}

interface CallEntry {
  id: number;
  name: string | null;
  image: string | null;
  call_status: string | null;
  note: string | null;
  date_time: string | null;
}

interface ActivitySummary {
  total_notes: number;
  total_calls: number;
  total_activities: number;
  last_activity_at: string | null;
}

interface LeadDetailsResult {
  lead: LeadProfile;
  notes?: NoteEntry[];
  calls?: CallEntry[];
  activities?: unknown;
  activity_summary: ActivitySummary;
}

interface LeadByIdRecord {
  id?: number;
  form_id?: number | null;
  pipeline_id?: number | null;
  pipeline_char?: string;
  priority?: string;
  lead_source?: string;
  lead_source_child?: string | null;
  lead_name?: string;
  mobile_no?: string;
  email?: string;
  assigned_to?: number | null;
  follow_up_date?: string;
  company_id?: number;
  company_type?: string;
  response?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  assigned_to_details?: { name?: string | null; image?: string | null } | null;
}

interface LeadByIdResponse {
  data: {
    data: LeadByIdRecord | null;
  };
}

interface NoteRecord {
  id?: number;
  title?: string | null;
  text?: string | null;
  files?: unknown[];
  conversations?: unknown[];
  date?: string | null;
}
interface NotesResponse {
  data: {
    data: NoteRecord[];
  };
}

interface CallRecord {
  id?: number;
  name?: string | null;
  image?: string | null;
  call_status?: string | null;
  note?: string | null;
  dateTime?: string | null;
}
interface CallsResponse {
  data: {
    data: CallRecord[];
  };
}

interface ActivityGroup {
  date?: string;
  items?: Array<{ createdAt?: string; time?: string }>;
}
interface ActivitiesResponse {
  data: {
    data: unknown;
  };
}

function extractLatestActivityTimestamp(activities: unknown): string | null {
  if (!Array.isArray(activities)) return null;
  let latest: string | null = null;
  for (const group of activities as ActivityGroup[]) {
    for (const item of group?.items ?? []) {
      const t = item?.createdAt ?? item?.time ?? null;
      if (t && (!latest || t > latest)) latest = t;
    }
  }
  return latest;
}

function deriveLeadName(record: LeadByIdRecord): string {
  if (record.lead_name) return record.lead_name;
  const resp = record.response ?? {};
  const candidates = [
    resp["Full Name"],
    resp["Name"],
    resp["full_name"],
    resp["name"],
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c;
  }
  if (record.email) return record.email;
  if (record.mobile_no) return record.mobile_no;
  return "Unknown";
}

export const getLeadDetailsTool: ToolDefinition<
  typeof schema,
  LeadDetailsResult
> = {
  name: "get_lead_details",
  title: "Get lead details — full profile, notes, calls, activity timeline",
  description:
    "Returns a single lead's complete profile: name, phone, email, source, pipeline stage, " +
    "priority, assignee (with name + image), follow-up date, company, the raw form response " +
    "(all captured field values), and timestamps. Optionally includes notes (with " +
    "conversations/attachments), call logs (with status and caller), and an activity " +
    "timeline — plus a small summary counting each block and the last activity timestamp. " +
    "\n\nUNDERSTANDING THE FLOW: Leads are captured via forms (list_forms), assigned to a " +
    "pipeline, and progress through stages. Use this tool when the user asks about a specific " +
    "lead by ID and needs the full picture — other list-style tools return summary rows. " +
    "\n\nUSE THIS TOOL TO: open a single lead's profile, fetch a lead's notes + calls + " +
    "activity together, see who owns a lead, check its current stage and priority, or pull " +
    "the raw form response fields. Pass `include` to narrow which blocks to fetch. " +
    "\n\nNOTE: Fetches up to four endpoints in parallel; blocks are skipped if not in " +
    "`include`. Pipeline and form names are not resolved here — use list_pipelines / " +
    "list_forms alongside if you need the human-readable names. Returns a 404-style error " +
    "if the lead does not exist.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "2.0.0", tags: ["leads", "lookup"] },

  handler: async (input, ctx) => {
    const body = { lead_id: input.lead_id };
    const wantNotes = input.include.includes("notes");
    const wantCalls = input.include.includes("calls");
    const wantActivities = input.include.includes("activities");

    const [leadRes, notesRes, callsRes, activitiesRes] = await Promise.all([
      apiPost<LeadByIdResponse>(`${SERVICE.LEADS}/getLeadById`, body, ctx, {
        injectCompanyContext: false,
      }),
      wantNotes
        ? apiPost<NotesResponse>(`${SERVICE.LEADS}/getLeadNote`, body, ctx)
        : Promise.resolve<NotesResponse>({ data: { data: [] } }),
      wantCalls
        ? apiPost<CallsResponse>(`${SERVICE.LEADS}/getLeadCalls`, body, ctx)
        : Promise.resolve<CallsResponse>({ data: { data: [] } }),
      wantActivities
        ? apiPost<ActivitiesResponse>(
            `${SERVICE.LEADS}/getLeadActivities`,
            body,
            ctx,
            { injectCompanyContext: false },
          )
        : Promise.resolve<ActivitiesResponse>({ data: { data: [] } }),
    ]);

    const raw = leadRes.data?.data ?? null;
    if (!raw) {
      throw new Error(`[NOT_FOUND] Lead ${input.lead_id} not found`);
    }

    const assigned = raw.assigned_to_details ?? null;

    const lead: LeadProfile = {
      lead_id: raw.id ?? input.lead_id,
      form_id: raw.form_id ?? null,
      pipeline_id: raw.pipeline_id ?? null,
      pipeline_stage: raw.pipeline_char ?? "",
      priority: raw.priority ?? "Medium",
      source: raw.lead_source ?? "unknown",
      source_child: raw.lead_source_child ?? null,
      name: deriveLeadName(raw),
      phone: raw.mobile_no ?? "",
      email: raw.email ?? "",
      assigned_to: raw.assigned_to ?? null,
      assigned_to_name: assigned?.name ?? null,
      assigned_to_image: assigned?.image ?? null,
      follow_up_date: raw.follow_up_date ?? null,
      company_id: raw.company_id ?? null,
      company_type: raw.company_type ?? null,
      response: raw.response ?? {},
      created_at: raw.createdAt ?? "",
      updated_at: raw.updatedAt ?? "",
    };

    const notesRaw = notesRes.data?.data ?? [];
    const callsRaw = callsRes.data?.data ?? [];
    const activitiesRaw = activitiesRes.data?.data ?? [];

    const notes: NoteEntry[] = notesRaw.map((n) => ({
      id: n.id ?? 0,
      title: n.title ?? null,
      text: n.text ?? null,
      files: n.files ?? [],
      conversations: n.conversations ?? [],
      date: n.date ?? null,
    }));

    const calls: CallEntry[] = callsRaw.map((c) => ({
      id: c.id ?? 0,
      name: c.name ?? null,
      image: c.image ?? null,
      call_status: c.call_status ?? null,
      note: c.note ?? null,
      date_time: c.dateTime ?? null,
    }));

    const activitiesCount = Array.isArray(activitiesRaw)
      ? (activitiesRaw as ActivityGroup[]).reduce(
          (n, g) => n + (g?.items?.length ?? 0),
          0,
        )
      : 0;

    const result: LeadDetailsResult = {
      lead,
      activity_summary: {
        total_notes: notes.length,
        total_calls: calls.length,
        total_activities: activitiesCount,
        last_activity_at: extractLatestActivityTimestamp(activitiesRaw),
      },
    };

    if (wantNotes) result.notes = notes;
    if (wantCalls) result.calls = calls;
    if (wantActivities) result.activities = activitiesRaw;

    return result;
  },
};

toolRegistry.register(getLeadDetailsTool);
