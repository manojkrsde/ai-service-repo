import { z } from "zod";

import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  lead_id: z
    .number()
    .int()
    .positive()
    .describe("Lead id whose notes to list."),
});

interface LeadNoteSummary {
  id: number;
  title: string | null;
  text: string;
  date: string | null;
  files: unknown[];
  conversations: unknown[];
}

interface ListLeadNotesResult {
  lead_id: number;
  total: number;
  notes: LeadNoteSummary[];
}

interface RawLeadNote {
  id?: number;
  title?: string | null;
  text?: string;
  date?: string;
  files?: unknown[];
  conversations?: unknown[];
}

interface ListLeadNotesResponse {
  data?: { data?: RawLeadNote[] };
}

export const listLeadNotesTool: ToolDefinition<
  typeof schema,
  ListLeadNotesResult
> = {
  name: "list_lead_notes",
  title: "List notes attached to a lead",
  description:
    "Returns every note attached to one lead, newest first. Each row carries: id, title, " +
    "text body, date created, attached files, and any nested conversation/replies threaded " +
    "onto the note." +
    "\n\nUNDERSTANDING THE FLOW: Backend reads `t_comapnies_lead_notes` filtered by " +
    "`lead_id` and the caller's company. Soft-delete is not applied — the table is append-only " +
    "in practice. company_id / company_type are auto-injected." +
    "\n\nUSE THIS TOOL TO: render the notes panel on a lead profile, summarise the agent's " +
    "interaction history, or look up the most recent note before adding a follow-up." +
    "\n\nNOTE: To add a new note use `add_note_to_lead`. For the full activity timeline " +
    "(notes + calls + stage changes) use `get_lead_activity`.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leads", "notes", "list"] },

  handler: async (input, ctx) => {
    const res = await apiPost<ListLeadNotesResponse>(
      `${SERVICE.LEADS}/getLeadNote`,
      { lead_id: input.lead_id },
      ctx,
    );

    const list = res?.data?.data ?? [];

    const notes: LeadNoteSummary[] = list.map((n) => ({
      id: n.id ?? 0,
      title: n.title ?? null,
      text: n.text ?? "",
      date: n.date ?? null,
      files: n.files ?? [],
      conversations: n.conversations ?? [],
    }));

    return { lead_id: input.lead_id, total: notes.length, notes };
  },
};

toolRegistry.register(listLeadNotesTool);
