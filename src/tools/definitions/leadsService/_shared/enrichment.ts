import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import { extractLeadName } from "./lead.helpers.js";
import type { ToolContext } from "../../../../types/tool.types.js";

export interface LeadLike {
  id?: number;
  mobile_no?: string | null;
  email?: string | null;
  lead_source?: string | null;
  lead_source_child?: string | null;
  pipeline_char?: string | null;
  pipeline_id?: number | null;
  priority?: string | null;
  form_id?: number | null;
  assigned_to?: number | null;
  follow_up_date?: string | null;
  created_at?: string | null;
  createdAt?: string | null;
  response?: Record<string, unknown>;
}

export interface EnrichedLead {
  lead_id: number;
  name: string;
  phone: string;
  email: string;
  source: string;
  source_child: string | null;
  stage: string;
  priority: string;
  pipeline_id: number | null;
  pipeline_name: string | null;
  form_id: number | null;
  form_name: string | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  follow_up_date: string | null;
  created_at: string;
}

export interface EnrichmentCache {
  pipelineNames?: Map<number, string>;
  formNames?: Map<number, string>;
  employeeNames?: Map<number, string>;
}

export function createEnrichmentCache(): EnrichmentCache {
  return {};
}

interface PipelineRecord {
  id?: number;
  pipeline_name?: string;
}
interface AllPipelinesResponse {
  data?: PipelineRecord[];
}

interface FormRecord {
  id?: number;
  key?: number;
  name?: string;
  LeadFormName?: string;
}
interface AllFormsResponse {
  data?: FormRecord[];
}

interface EmployeeRecord {
  key?: number;
  Name?: string;
}
interface EmployeesResponse {
  data?: { allUsers?: EmployeeRecord[] };
}

async function loadPipelineNames(
  ctx: ToolContext,
  cache: EnrichmentCache,
): Promise<Map<number, string>> {
  if (cache.pipelineNames) return cache.pipelineNames;
  const m = new Map<number, string>();
  try {
    const res = await apiPost<AllPipelinesResponse>(`${SERVICE.LEADS}/getAllPipelines`,
      {},
      ctx,
    );
    for (const p of res.data ?? []) {
      if (p.id !== undefined) {
        m.set(p.id, p.pipeline_name ?? `Pipeline ${p.id}`);
      }
    }
  } catch {
    // degrade silently — enrichment is best-effort
  }
  cache.pipelineNames = m;
  return m;
}

async function loadFormNames(
  ctx: ToolContext,
  cache: EnrichmentCache,
): Promise<Map<number, string>> {
  if (cache.formNames) return cache.formNames;
  const m = new Map<number, string>();
  try {
    const res = await apiPost<AllFormsResponse>(`${SERVICE.LEADS}/getAllLeadForms`, {}, ctx);
    for (const f of res.data ?? []) {
      // Backend returns { key, LeadFormName } from getLeadFormByCompany
      // and { key, LeadFormName } from getLeadForm
      const fid = f.key ?? f.id;
      const fname = f.LeadFormName ?? f.name;
      if (fid !== undefined) {
        m.set(fid, fname ?? `Form ${fid}`);
      }
    }
  } catch {
    // degrade silently
  }
  cache.formNames = m;
  return m;
}

async function loadEmployeeNames(
  ctx: ToolContext,
  cache: EnrichmentCache,
): Promise<Map<number, string>> {
  if (cache.employeeNames) return cache.employeeNames;
  const m = new Map<number, string>();
  try {
    const res = await apiPost<EmployeesResponse>(`${SERVICE.USERS}/getActiveEmployeesListData`,
      {},
      ctx,
    );
    for (const u of res.data?.allUsers ?? []) {
      if (u.key !== undefined) {
        m.set(u.key, u.Name ?? `User ${u.key}`);
      }
    }
  } catch {
    // degrade silently
  }
  cache.employeeNames = m;
  return m;
}

function normalizeLeadFields(lead: LeadLike): {
  phone: string;
  email: string;
  createdAt: string;
} {
  return {
    phone: lead.mobile_no ?? "",
    email: lead.email ?? "",
    createdAt: lead.created_at ?? lead.createdAt ?? "",
  };
}

export async function enrichLead(
  lead: LeadLike,
  ctx: ToolContext,
  cache: EnrichmentCache = createEnrichmentCache(),
): Promise<EnrichedLead> {
  const needsPipeline = lead.pipeline_id != null;
  const needsForm = lead.form_id != null;
  const needsEmployee = lead.assigned_to != null;

  const [pipelineMap, formMap, employeeMap] = await Promise.all([
    needsPipeline
      ? loadPipelineNames(ctx, cache)
      : Promise.resolve(cache.pipelineNames ?? new Map<number, string>()),
    needsForm
      ? loadFormNames(ctx, cache)
      : Promise.resolve(cache.formNames ?? new Map<number, string>()),
    needsEmployee
      ? loadEmployeeNames(ctx, cache)
      : Promise.resolve(cache.employeeNames ?? new Map<number, string>()),
  ]);

  const { phone, email, createdAt } = normalizeLeadFields(lead);

  const nameSource: {
    email?: string;
    mobile_no?: string;
    response?: Record<string, unknown>;
  } = {};
  if (typeof lead.email === "string") nameSource.email = lead.email;
  if (typeof lead.mobile_no === "string") nameSource.mobile_no = lead.mobile_no;
  if (lead.response) nameSource.response = lead.response;

  return {
    lead_id: lead.id ?? 0,
    name: extractLeadName(nameSource),
    phone,
    email,
    source: lead.lead_source ?? "unknown",
    source_child: lead.lead_source_child ?? null,
    stage: lead.pipeline_char ?? "unknown",
    priority: lead.priority ?? "unknown",
    pipeline_id: lead.pipeline_id ?? null,
    pipeline_name:
      lead.pipeline_id != null
        ? (pipelineMap.get(lead.pipeline_id) ?? null)
        : null,
    form_id: lead.form_id ?? null,
    form_name:
      lead.form_id != null ? (formMap.get(lead.form_id) ?? null) : null,
    assigned_to: lead.assigned_to ?? null,
    assigned_to_name:
      lead.assigned_to != null
        ? (employeeMap.get(lead.assigned_to) ?? null)
        : null,
    follow_up_date: lead.follow_up_date ?? null,
    created_at: createdAt,
  };
}

export async function enrichLeads(
  leads: LeadLike[],
  ctx: ToolContext,
  cache: EnrichmentCache = createEnrichmentCache(),
): Promise<EnrichedLead[]> {
  if (leads.length === 0) return [];

  const hasPipeline = leads.some((l) => l.pipeline_id != null);
  const hasForm = leads.some((l) => l.form_id != null);
  const hasEmployee = leads.some((l) => l.assigned_to != null);

  await Promise.all([
    hasPipeline ? loadPipelineNames(ctx, cache) : Promise.resolve(),
    hasForm ? loadFormNames(ctx, cache) : Promise.resolve(),
    hasEmployee ? loadEmployeeNames(ctx, cache) : Promise.resolve(),
  ]);

  return Promise.all(leads.map((l) => enrichLead(l, ctx, cache)));
}
