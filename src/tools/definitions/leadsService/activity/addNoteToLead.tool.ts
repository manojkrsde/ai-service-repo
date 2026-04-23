// AUDIT (v1):
// - Verdict: KEEP
// - Low-risk additive; backend enforces access on the lead.

/**
 * Adds a note to a lead.
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
    .describe("The internal CRM ID of the lead to annotate"),
  content: z.string().min(1).describe("The body text of the note"),
  title: z
    .string()
    .optional()
    .describe('Short heading for the note (defaults to "Note")'),
});

interface AddNoteResult {
  success: boolean;
  lead_id: number;
  note_id: number | null;
}

interface NoteResponse {
  success?: boolean;
  data?: { id?: number };
  id?: number;
}

export const addNoteToLeadTool: ToolDefinition<typeof schema, AddNoteResult> =
  {
    name: "add_note_to_lead",
    title: "Add Note to Lead",
    description:
      "Attaches a text note to a lead's record. " +
      "Use this to log important context, summarise a conversation, " +
      "or record information that should be visible to the next agent who handles the lead.",
    inputSchema: schema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    },
    meta: { version: "1.0.0", tags: ["action", "leads", "notes"] },

    handler: async (input, ctx) => {
      const body: Record<string, unknown> = {
        lead_id: input.lead_id,
        note: input.content,
        title: input.title ?? "Note",
      };

      const res = await apiPost<NoteResponse>(`${SERVICE.LEADS}/addLeadnote`, body, ctx);

      const noteId = res.data?.id ?? res.id ?? null;

      return {
        success: true,
        lead_id: input.lead_id,
        note_id: noteId !== undefined ? noteId : null,
      };
    },
  };

toolRegistry.register(addNoteToLeadTool);
