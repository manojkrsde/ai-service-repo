/**
 * Adds a free-text note to a lead.
 *
 * Wraps POST /addLeadnote. Backend middleware requires
 * signature + lead_id + company_id + company_type + note;
 * title / attachments / conversation are optional.
 *
 * Backend returns only a status envelope ({ message: [{ msg, status }] })
 * — there is no `note_id` in the response.
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
    .describe("The internal CRM ID of the lead to annotate."),
  note: z
    .string()
    .trim()
    .min(1)
    .describe("Body text of the note (required, non-empty)."),
  title: z
    .string()
    .optional()
    .describe('Optional short heading for the note (defaults to "Note").'),
  attachments: z
    .array(z.unknown())
    .optional()
    .describe(
      "Optional array of attachment objects (e.g. uploaded file URLs).",
    ),
});

interface AddNoteResult {
  success: boolean;
  lead_id: number;
  message: string;
}

interface BackendMessageItem {
  msg?: string;
  message?: string;
  status?: boolean;
}

interface BackendEnvelope {
  message?: BackendMessageItem[] | BackendMessageItem;
}

function extractMessage(res: BackendEnvelope | undefined): string {
  const m = res?.message;
  if (Array.isArray(m)) return m[0]?.msg ?? m[0]?.message ?? "";
  if (m && typeof m === "object") return m.msg ?? m.message ?? "";
  return "";
}

export const addNoteToLeadTool: ToolDefinition<typeof schema, AddNoteResult> = {
  name: "add_note_to_lead",
  title:
    "Add note to lead — attach a free-text note (and optional attachments)",
  description:
    "Attaches a text note to a lead's record. Notes appear in get_lead_details (under " +
    "`notes`) and on the activity timeline. " +
    "\n\nUNDERSTANDING THE FLOW: Notes are append-only. The backend writes both the note and " +
    "an activity-log entry (NOTE_ADDED) tagged to the calling user. Title defaults to 'Note' " +
    "when omitted. Attachments must be a JSON-serialisable array of objects (typically " +
    "uploaded-file metadata) — the backend stores them as-is on the note row. " +
    "\n\nUSE THIS TOOL TO: log a conversation summary, capture next steps, paste an inbound " +
    "email body for the next agent, or record decisions made on a call. " +
    "\n\nNOTE: Backend doesn't return a note_id; only a success/failure status. To list notes " +
    "for a lead use get_lead_details with include including 'notes'.",
  inputSchema: schema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
  },
  meta: { version: "2.0.0", tags: ["action", "leads", "notes"] },

  handler: async (input, ctx) => {
    const body: Record<string, unknown> = {
      lead_id: input.lead_id,
      note: input.note,
      title: input.title ?? "Note",
    };
    if (input.attachments !== undefined)
      body["attachments"] = input.attachments;

    const res = await apiPost<BackendEnvelope>(
      `${SERVICE.LEADS}/addLeadnote`,
      body,
      ctx,
    );

    return {
      success: true,
      lead_id: input.lead_id,
      message: extractMessage(res) || "Note added successfully",
    };
  },
};

toolRegistry.register(addNoteToLeadTool);
