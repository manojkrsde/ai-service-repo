# ai-services

> MCP server + Express bridge for the LGS CRM backend. **92 tools across 10 services**, OAuth 2.1 + PKCE auth, TypeScript ESM.

`ai-services` is a single Node.js/TypeScript process that exposes the LGS CRM (leads, calls, attendance, drive, tickets, todos, reports, assets, calendar, user directory) as a [Model Context Protocol](https://modelcontextprotocol.io/) tool surface. AI clients (Claude Desktop, Cursor, custom MCP clients) connect over Streamable HTTP, authenticate via OAuth 2.1 + PKCE, and call tools by name. Every tool is a thin, validated wrapper around an existing API-gateway endpoint — this service does **not** own data, schemas, or business logic.

---

## Table of contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Authentication](#authentication)
- [Tool input/output pattern](#tool-inputoutput-pattern)
- [Available tools](#available-tools)
- [Adding a new tool](#adding-a-new-tool)
- [Recurring todos](#recurring-todos)
- [JSON-RPC payload example](#json-rpc-payload-example)
- [Development](#development)
- [Contributing](#contributing)

---

## Overview

- **Transport.** [MCP Streamable HTTP](https://modelcontextprotocol.io/specification/2024-11-05/basic/transports#streamable-http) on `POST /mcp`, `GET /mcp`, `DELETE /mcp`. Stateless — no in-memory session map; every request reconstructs auth from a persisted token row.
- **Auth.** OAuth 2.1 + PKCE. Login flow served from `/authorize`, token exchange at `/token`, discovery at `/.well-known/oauth-authorization-server`. Backend JWT + signature are resolved once at `/token` and cached in the `mcp_access_tokens` table.
- **Tools.** 92 read-only and write tools registered via a single transport-agnostic registry. Each tool validates its input with Zod, calls an upstream CRM endpoint via `apiPost`, and returns a typed result.
- **Consumers today.** MCP clients (Claude Desktop, Cursor, programmatic). A React dashboard chat path is planned but not built.

---

## Architecture

### Request lifecycle

```
MCP client
   │  POST /mcp   { jsonrpc, method: "tools/call", params: { name, arguments } }
   │  Authorization: Bearer <mcp_access_token>
   ▼
[src/routes/mcp/streamable.route.ts]
   │
   ▼
[src/mcp/handlers/streamable.handler.ts]   ── authorize() loads token row
   │                                          builds SessionAuth (cached JWT + signature)
   │                                          creates fresh McpServer + StreamableHTTPServerTransport
   ▼
[src/mcp/tools/index.ts]                   ── for each registered tool, bind a wrappedHandler that
   │                                          builds ToolContext { sessionAuth, companyId, companyType, userId }
   │                                          calls executeTool(name, rawInput, ctx)
   ▼
[src/tools/executor.ts]                    ── lookup by name → Zod safeParse → handler(input, ctx)
   │                                          returns ToolOutcome
   ▼
[src/tools/definitions/<service>/<sub>/<verb>.tool.ts]
   │                                          builds body, calls apiPost(path, body, ctx, opts?)
   ▼
[src/helpers/api.client.ts → src/helpers/authed-axios.ts]
   │                                          doPost adds: signature (always)
   │                                          + company_id, company_type (default snake_case, default ON)
   │                                          + Authorization: Bearer <cachedToken>
   ▼
LGS API gateway (config.services.apiGateway)
```

### Layers

| Layer | Folder | Role |
| --- | --- | --- |
| Entry | [src/index.ts](src/index.ts) | Helmet, CORS, rate limit, logger, routes mount, graceful shutdown |
| Routes | [src/routes/](src/routes/) | Thin route definitions; OAuth routes at `/`, MCP routes at `/mcp` |
| MCP | [src/mcp/](src/mcp/) | Streamable HTTP handler, MCP SDK wrapper, tool binding, auth utility |
| Tools | [src/tools/](src/tools/) | Registry, executor, MCP/OpenAI/Anthropic adapters, 92 tool definitions |
| Helpers | [src/helpers/](src/helpers/) | `apiPost` wrapper, authed axios, env helpers, phone/date/fuzzy utilities |
| Services | [src/services/](src/services/) | OAuth store, MCP auth helpers, persistence access |
| Models | [src/models/](src/models/) | Sequelize models (`mcp_access_tokens`, `mcp_auth_codes`, `mcp_tool_logs`) |
| Config | [src/config/](src/config/) | Typed env, pino logger, helmet/cors/rateLimit configs |
| Errors | [src/errors/](src/errors/) | `BaseError` hierarchy + HTTP/tool error subclasses |
| Types | [src/types/](src/types/) | `ToolDefinition`, `ToolContext`, `ToolOutcome`, etc. |
| Utils | [src/utils/](src/utils/) | Shared axios instance, global error handler |
| Migrations | [src/migrations/](src/migrations/) | Sequelize migrations for the OAuth tables |

### Tech stack

Node 20.x · TypeScript 5.8 (strict + `exactOptionalPropertyTypes` + `verbatimModuleSyntax`) · ESM only · Express 5 · `@modelcontextprotocol/sdk` 1.29 · Zod 4 · axios · Sequelize / Postgres · pino. No model router, no Redis, no message broker — those are not built.

---

## Project structure

```
ai-services/
├── package.json                ESM, Node 20, scripts (dev / build / typecheck / migrate)
├── tsconfig.json               strict + exactOptionalPropertyTypes + verbatimModuleSyntax
├── .env.example                env vars consumed by src/config/env.ts
├── .sequelizerc                points migrations / models / seeders into src/
├── vercel.json                 single-entrypoint Vercel config
└── src/
    ├── index.ts                Express bootstrap
    ├── config/                 env, logger, cors, helmet, rateLimit
    ├── errors/                 BaseError + http/tool subclasses
    ├── helpers/                api.client, authed-axios, env, phone, time-range, fuzzy-name, slug
    ├── middlewares/            request-logger
    ├── migrations/             Sequelize migrations for OAuth tables
    ├── models/                 mcp_access_tokens, mcp_auth_codes, mcp_tool_logs
    ├── mcp/                    server, handlers, auth utilities, tool binder
    ├── routes/                 root router → /, /mcp
    ├── services/               oauthStore, mcpAuth
    ├── tools/
    │   ├── registry.ts         toolRegistry singleton
    │   ├── executor.ts         executeTool(name, input, ctx)
    │   ├── adapters/           toMcpTool, toOpenAITool, toAnthropicTool
    │   ├── index.ts            barrel — side-effect imports for every service
    │   └── definitions/        92 *.tool.ts files, grouped by service/subdomain
    ├── types/                  tool.types.ts, index.ts
    └── utils/                  axios.instance.ts, error-handler.ts
```

---

## Getting started

### Prerequisites

- Node.js **20.x** (see `engines.node` in `package.json`)
- PostgreSQL with three databases (local / staging / prod) — only one is needed at a time
- Network access to the LGS API gateway (`API_GATEWAY_URL`)

### Install and run

```bash
git clone <this-repo>
cd ai-services
npm install
cp .env.example .env       # then fill in DATABASE_URL_LOCAL, JWT_SECRET_KEY, MCP_SERVICE_KEY, API_GATEWAY_URL
npm run migrate            # creates mcp_auth_codes, mcp_access_tokens, mcp_tool_logs
npm run dev                # tsx watch on src/index.ts (port from PORT env, default 8099)
```

### Build and deploy

```bash
npm run typecheck          # tsc --noEmit
npm run build              # clean → tsc → postbuild
npm run prod               # build + migrate + start
```

Vercel: `vercel.json` ships `src/index.ts` as a single function via `@vercel/node`; `vercel-build` runs migrations then build.

---

## Environment variables

All values are read through typed helpers in [src/config/env.ts](src/config/env.ts) — never via `process.env` directly.

| Name | Required | Default | Purpose |
| --- | --- | --- | --- |
| `APP_NAME` | no | `ai-services` | Logger / health metadata |
| `NODE_ENV` | no | `development` | One of `development` / `production` / `test` |
| `PORT` | no | `8099` | HTTP listen port |
| `BASE_URL` | no | `http://localhost:8099` | Public origin used in OAuth metadata |
| `LOG_LEVEL` | no | `info` | `fatal` / `error` / `warn` / `info` / `debug` / `trace` |
| `DATABASE_URL_LOCAL` | yes (dev) | — | Postgres URL for local dev |
| `DATABASE_URL_STAGING` | yes (staging) | — | Postgres URL for staging |
| `DATABASE_URL_PROD` | yes (prod) | — | Postgres URL for prod |
| `JWT_SECRET_KEY` | yes | `lakheragroupservices` | Signing secret for any locally-issued JWTs |
| `JWT_EXPIRY` | no | `7d` | Default JWT TTL |
| `MCP_SERVICE_KEY` | yes | — | `x-service-key` for backend-to-backend OAuth proxy calls |
| `API_GATEWAY_URL` | yes | `http://localhost:8002` | Upstream CRM API gateway base URL |
| `REDIS_URL` | no | — | Reserved (no code path consumes it yet) |
| `RABBITMQ_URL` | no | — | Reserved (no code path consumes it yet) |
| `CLOUDINARY_URL` | no | — | Reserved (no code path consumes it yet) |
| `SLOW_REQUEST_MS` | no | `5000` | Logger threshold for slow-request warnings |
| `CORS_ALLOWED_ORIGINS` | no | `*` | Comma-separated allowlist or wildcard |
| `TRUST_PROXY_HOPS` | no | `1` | Express `trust proxy` count |
| `RATE_LIMIT_GENERAL_MAX` / `_WINDOW_MS` | no | `1000` / `60000` | General rate limit |
| `RATE_LIMIT_AUTH_MAX` / `_WINDOW_MS` | no | `10` / `900000` | Auth-route limit |
| `RATE_LIMIT_HEAVY_MAX` / `_WINDOW_MS` | no | `50` / `3600000` | Heavy-route limit |

---

## Authentication

### OAuth 2.1 + PKCE flow

Integrators do not call any auth endpoint directly — they configure their MCP client with the discovery URL and let the client run the dance.

1. Client fetches `GET /.well-known/oauth-authorization-server` and `GET /.well-known/oauth-protected-resource`.
2. Client (optionally) registers via `POST /register` (Dynamic Client Registration).
3. Client opens `GET /authorize?code_challenge=…` — server serves a login page; user enters email and OTP.
4. On success, server creates a short-lived `mcp_auth_codes` row and redirects back with `?code=…`.
5. Client `POST /token` with `code_verifier`. Server validates PKCE, calls `userService/internal/resolve-user-auth` once to obtain backend JWT + signature, and writes a row into `mcp_access_tokens` containing `cached_jwt` + `cached_signature` for the session's lifetime.
6. Every subsequent `POST /mcp` request carries `Authorization: Bearer <access_token>` — the server reads the token row, builds [`SessionAuth`](src/mcp/auth.types.ts), and attaches it to `ToolContext`. No backend re-auth happens per request.

A 401 from the upstream CRM revokes the access-token row; the client must re-run the flow.

### What gets auto-injected

`apiPost` (via `helpers/authed-axios.ts` `doPost`) adds the following to **every** tool's request body / headers — tool authors must **never** declare these fields in their input schema:

| Field | Source | Default behavior |
| --- | --- | --- |
| `signature` | `SessionAuth.cachedSignature` | always added to the body |
| `company_id` | `SessionAuth.companyId` | added when `injectCompanyContext: true` (default) |
| `company_type` | `SessionAuth.companyType` | added when `injectCompanyContext: true` (default) |
| `Authorization: Bearer <cachedToken>` | `SessionAuth.cachedToken` | always set as a header |

Some upstream Joi schemas reject unknown fields and use `c_id` / `c_type` instead of `company_id` / `company_type`. Those tools opt out of injection and pass the keys themselves — see [Disabling injection](#disabling-injection).

### `ToolContext` shape

Quoted from [src/types/tool.types.ts](src/types/tool.types.ts):

```ts
export interface ToolContext {
  requestId?: string;
  sessionId?: string;
  sessionAuth?: SessionAuth;
  companyId?: number;
  companyType?: string;
  userId?: number;
  invokedName?: string;
}
```

`SessionAuth` carries `email`, `userId`, `companyId`, `companyType`, `role`, `clientName`, `cachedToken`, `cachedSignature`, `accessToken` — populated once per request from the persisted token row.

---

## Tool input/output pattern

### One file per tool

Each tool lives at `src/tools/definitions/<service>/<subdomain>/<verbCamel>.tool.ts` and self-registers at module load:

```ts
import { z } from "zod";
import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  form_id: z.number().int().positive(),
  limit: z.number().int().min(1).max(500).default(100),
});

export const myTool: ToolDefinition<typeof schema, MyResult> = {
  name: "my_snake_case_name",
  title: "Short human-readable summary",
  description: "When to call this tool — the LLM reads this verbatim.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["domain"] },
  handler: async (input, ctx) => {
    const res = await apiPost<BackendShape>(`${SERVICE.LEADS}/route`, input, ctx);
    return reshape(res);
  },
};

toolRegistry.register(myTool);
```

The barrel [src/tools/index.ts](src/tools/index.ts) imports each service's `index.js` for side effects, which cascades to every leaf `*.tool.ts`.

### Zod validation

The executor calls `inputSchema.safeParse(rawInput)` before the handler. Validation failures return a `ToolOutcome` with `code: "VALIDATION"` and the issue list — the handler is never invoked.

### `apiPost` wrapper

```ts
apiPost<T>(
  path: string,                    // e.g. `${SERVICE.LEADS}/getAllLeadsResponse`
  body: Record<string, unknown>,   // tool-specific body
  ctx: ToolContext,                // forwarded from the executor
  options?: AuthedPostOptions,
): Promise<T>
```

`AuthedPostOptions`:

```ts
{
  injectCompanyContext?: boolean;             // default true
  companyContextKeyFormat?: "camel_case" | "snake_case";  // default "snake_case"
}
```

### Disabling injection

Some endpoints reject unknown fields or use legacy keys. In that case, opt out and set the keys yourself:

```ts
const body = {
  c_id: ctx.companyId,
  c_type: ctx.companyType,
  user_id: ctx.userId,
  start_date: input.start_date,
};

const res = await apiPost<Resp>(`${SERVICE.ATTENDANCE}/getEmployeeAttendance`, body, ctx, {
  injectCompanyContext: false,
});
```

Tools currently using this opt-out: most of `attendanceService/attendance/*`, `leadsService/crud/getLeadDetails`, `leadsService/crud/listForms`, `activityCalendarService/events/*`, and others — grep for `injectCompanyContext: false` to find the full list.

### `BackendEnvelope` + `pickFirst`

Several CRM endpoints return their result wrapped in a `message` field that may be either a single object or an array. Tools that hit those endpoints use a small inline normalizer:

```ts
interface BackendMessageItem {
  msg?: string;
  status?: boolean;
  data?: Record<string, unknown> | null;
}
interface BackendEnvelope { message?: BackendMessageItem[] | BackendMessageItem; }

function pickFirst(env: BackendEnvelope | undefined): BackendMessageItem {
  const m = env?.message;
  if (Array.isArray(m)) return m[0] ?? {};
  if (m && typeof m === "object") return m;
  return {};
}
```

See [createTodo.tool.ts](src/tools/definitions/todoService/todos/createTodo.tool.ts), [createLead.tool.ts](src/tools/definitions/leadsService/crud/createLead.tool.ts), [addTodoComment.tool.ts](src/tools/definitions/todoService/comments/addTodoComment.tool.ts) for canonical usage.

### `ToolOutcome`

Every tool call returns one of:

```ts
{ ok: true, data: <handler return value> }
{ ok: false, code: "NOT_FOUND" | "VALIDATION" | "HANDLER", message: string,
  issues?: ZodIssue[], cause?: unknown }
```

The MCP binder maps `ok: true` → `{ content: [{ type: "text", text: JSON.stringify(data) }], isError: false }` and `ok: false` → `{ content: [{ type: "text", text: "[CODE] message" }], isError: true }`.

---

## Available tools

92 tools across 10 services + 1 standalone (`ping`). Tools are registered alphabetically per subdomain; the registry name is the snake_case identifier you pass to `tools/call`.

### Summary

| Service | Count | Subdomains | Source |
| --- | ---: | --- | --- |
| `leadsService` | 20 | crud, stats, followups, activity, validation | [src/tools/definitions/leadsService/](src/tools/definitions/leadsService/) |
| `userService` | 15 | directory, orgStructure, analytics, assetMaster | [src/tools/definitions/userService/](src/tools/definitions/userService/) |
| `callLogsService` | 13 | logs, analytics, leads, imports | [src/tools/definitions/callLogsService/](src/tools/definitions/callLogsService/) |
| `employeeReportingService` | 10 | reports, teamReports, comments | [src/tools/definitions/employeeReportingService/](src/tools/definitions/employeeReportingService/) |
| `attendanceService` | 10 | attendance, leave | [src/tools/definitions/attendanceService/](src/tools/definitions/attendanceService/) |
| `raiseTicketsService` | 8 | tickets, comments, categories | [src/tools/definitions/raiseTicketsService/](src/tools/definitions/raiseTicketsService/) |
| `assetsService` | 5 | inventory, history, analytics | [src/tools/definitions/assetsService/](src/tools/definitions/assetsService/) |
| `todoService` | 4 | todos, comments | [src/tools/definitions/todoService/](src/tools/definitions/todoService/) |
| `driveService` | 4 | files, stats | [src/tools/definitions/driveService/](src/tools/definitions/driveService/) |
| `activityCalendarService` | 2 | events | [src/tools/definitions/activityCalendarService/](src/tools/definitions/activityCalendarService/) |
| core | 1 | — | [src/tools/definitions/ping.tool.ts](src/tools/definitions/ping.tool.ts) |
| **Total** | **92** | | |

### `leadsService` (20)

<details><summary>20 tools</summary>

| Registry name | Title | Source |
| --- | --- | --- |
| `add_note_to_lead` | Add note to lead — attach a free-text note (and optional attachments) | [activity/addNoteToLead](src/tools/definitions/leadsService/activity/addNoteToLead.tool.ts) |
| `get_lead_activity` | Get lead activity timeline — calls + notes + stage changes grouped by date | [activity/getLeadActivity](src/tools/definitions/leadsService/activity/getLeadActivity.tool.ts) |
| `list_lead_calls` | List call history for a lead — every connected/missed/outgoing call | [activity/listLeadCalls](src/tools/definitions/leadsService/activity/listLeadCalls.tool.ts) |
| `list_lead_notes` | List notes attached to a lead | [activity/listLeadNotes](src/tools/definitions/leadsService/activity/listLeadNotes.tool.ts) |
| `create_lead` | Create lead — submit a new lead via a capture form | [crud/createLead](src/tools/definitions/leadsService/crud/createLead.tool.ts) |
| `get_lead_details` | Get lead details — full profile, notes, calls, activity timeline | [crud/getLeadDetails](src/tools/definitions/leadsService/crud/getLeadDetails.tool.ts) |
| `list_forms` | Browse lead capture forms — pipelines, stages, and assignments | [crud/listForms](src/tools/definitions/leadsService/crud/listForms.tool.ts) |
| `list_lead_history` | Search lead history — every lead ever assigned, with source / form / date / text filters | [crud/listLeadHistory](src/tools/definitions/leadsService/crud/listLeadHistory.tool.ts) |
| `list_leads` | List leads — enriched records with stage, source, priority & assignee | [crud/listLeads](src/tools/definitions/leadsService/crud/listLeads.tool.ts) |
| `list_pipelines` | Browse pipelines — ordered stage lists, type & company scope | [crud/listPipelines](src/tools/definitions/leadsService/crud/listPipelines.tool.ts) |
| `list_unassigned_leads` | List unassigned leads — queue of leads waiting for an owner | [crud/listUnassignedLeads](src/tools/definitions/leadsService/crud/listUnassignedLeads.tool.ts) |
| `update_lead` | Update lead — change priority or edit form-response fields | [crud/updateLead](src/tools/definitions/leadsService/crud/updateLead.tool.ts) |
| `add_lead_followup` | Schedule a follow-up reminder on a lead | [followups/addLeadFollowUp](src/tools/definitions/leadsService/followups/addLeadFollowUp.tool.ts) |
| `get_lead_follow_ups` | Get lead follow-ups — pending reminders bucketed today / overdue / upcoming | [followups/getLeadFollowUps](src/tools/definitions/leadsService/followups/getLeadFollowUps.tool.ts) |
| `get_lead_reminders` | Get lead reminders — pending reminders for a single lead, bucketed | [followups/getLeadReminders](src/tools/definitions/leadsService/followups/getLeadReminders.tool.ts) |
| `get_lead_stats_by_form_field` | Get lead/deal stats by geography form field — total or city/state/country/district | [stats/getLeadStatsByFormField](src/tools/definitions/leadsService/stats/getLeadStatsByFormField.tool.ts) |
| `get_overall_stage_counts` | Get overall stage counts — leads-per-stage on a form | [stats/getOverallStageCounts](src/tools/definitions/leadsService/stats/getOverallStageCounts.tool.ts) |
| `get_overdue_leads` | Get overdue leads — pending reminders past their follow-up date | [stats/getOverdueLeads](src/tools/definitions/leadsService/stats/getOverdueLeads.tool.ts) |
| `get_user_lead_stats` | Get lead/deal stats — personal dashboard or tenant-wide analytics | [stats/getUserLeadStats](src/tools/definitions/leadsService/stats/getUserLeadStats.tool.ts) |
| `check_duplicate_phone` | Check duplicate phone — does this number already exist as a lead? | [validation/checkDuplicatePhone](src/tools/definitions/leadsService/validation/checkDuplicatePhone.tool.ts) |

</details>

### `userService` (15)

<details><summary>15 tools</summary>

| Registry name | Title | Source |
| --- | --- | --- |
| `get_employee_statistics` | HR analytics — headcount, hiring, attrition, gender split, dept/designation distribution | [analytics/getEmployeeStatistics](src/tools/definitions/userService/analytics/getEmployeeStatistics.tool.ts) |
| `get_mood_analytics` | Employee engagement analytics — mood distribution, trend & participation by department | [analytics/getMoodAnalytics](src/tools/definitions/userService/analytics/getMoodAnalytics.tool.ts) |
| `list_asset_categories` | List asset categories — hierarchical asset-type taxonomy (laptops, phones, …) | [assetMaster/listAssetCategories](src/tools/definitions/userService/assetMaster/listAssetCategories.tool.ts) |
| `list_asset_products` | List asset products — every catalogued asset (laptops, phones, monitors) in inventory | [assetMaster/listAssetProducts](src/tools/definitions/userService/assetMaster/listAssetProducts.tool.ts) |
| `list_unassigned_asset_products` | List unallocated asset stock — products ready to assign to a user/location/department | [assetMaster/listUnassignedAssetProducts](src/tools/definitions/userService/assetMaster/listUnassignedAssetProducts.tool.ts) |
| `get_employee_by_id` | Get a single employee's full profile by user_id — name, contact, role, manager, dates | [directory/getEmployeeById](src/tools/definitions/userService/directory/getEmployeeById.tool.ts) |
| `list_reporting_officers` | List potential reporting officers (managers) — every non-admin employee | [directory/getReportingOfficer](src/tools/definitions/userService/directory/getReportingOfficer.tool.ts) |
| `list_active_employees` | Active employees only — lighter alternative to list_employees | [directory/listActiveEmployees](src/tools/definitions/userService/directory/listActiveEmployees.tool.ts) |
| `list_child_companies` | List child / subsidiary companies under the parent tenant | [directory/listChildCompanies](src/tools/definitions/userService/directory/listChildCompanies.tool.ts) |
| `list_employees` | Look up employees — contact info, department, manager, status & more | [directory/listEmployees](src/tools/definitions/userService/directory/listEmployees.tool.ts) |
| `get_company_settings` | Get company configuration — biometric, policy & feature settings | [orgStructure/getCompanySettings](src/tools/definitions/userService/orgStructure/getCompanySettings.tool.ts) |
| `list_departments` | Browse departments — names, headcount, and status | [orgStructure/listDepartments](src/tools/definitions/userService/orgStructure/listDepartments.tool.ts) |
| `list_designations` | List job designations / titles — every role with its parent department, headcount & status | [orgStructure/listDesignations](src/tools/definitions/userService/orgStructure/listDesignations.tool.ts) |
| `list_designations_with_user_count` | List designations with employees per role — staffing breakdown by job title | [orgStructure/listDesignationsWithUserCount](src/tools/definitions/userService/orgStructure/listDesignationsWithUserCount.tool.ts) |
| `list_locations` | List company locations / sites — buildings, floors, rooms | [orgStructure/listLocations](src/tools/definitions/userService/orgStructure/listLocations.tool.ts) |

</details>

### `callLogsService` (13)

<details><summary>13 tools</summary>

| Registry name | Title | Source |
| --- | --- | --- |
| `get_call_dashboard` | Get call dashboard — today/week/month/total KPIs + per-user breakdown | [analytics/getCallDashboard](src/tools/definitions/callLogsService/analytics/getCallDashboard.tool.ts) |
| `get_daily_call_stats` | Get daily call stats — per-day, per-user breakdown of every call type | [analytics/getDailyCallStats](src/tools/definitions/callLogsService/analytics/getDailyCallStats.tool.ts) |
| `get_user_call_stats` | Get user call stats — current vs previous period KPIs with growth % | [analytics/getUserCallStats](src/tools/definitions/callLogsService/analytics/getUserCallStats.tool.ts) |
| `list_bulk_import_batches` | List bulk-imported call lead batches — file uploads | [imports/listBulkImportBatches](src/tools/definitions/callLogsService/imports/listBulkImportBatches.tool.ts) |
| `list_leads_by_import_batch` | List call leads from a single bulk-import batch | [imports/listLeadsByImportBatch](src/tools/definitions/callLogsService/imports/listLeadsByImportBatch.tool.ts) |
| `list_leads_by_employee` | List leads by employee — every lead assigned to one or more agents | [leads/listLeadsByEmployee](src/tools/definitions/callLogsService/leads/listLeadsByEmployee.tool.ts) |
| `list_unassigned_call_leads` | List unassigned call leads — contacts in the queue with no calls yet | [leads/listUnassignedCallLeads](src/tools/definitions/callLogsService/leads/listUnassignedCallLeads.tool.ts) |
| `list_worked_call_leads` | List worked call leads — contacts with at least one call, with rich filters | [leads/listWorkedCallLeads](src/tools/definitions/callLogsService/leads/listWorkedCallLeads.tool.ts) |
| `search_call_contacts` | Search call contacts — find a lead in the call-center list by phone or name | [leads/searchCallContacts](src/tools/definitions/callLogsService/leads/searchCallContacts.tool.ts) |
| `get_call_followups` | Get pending call follow-ups for the caller | [logs/getCallFollowUps](src/tools/definitions/callLogsService/logs/getCallFollowUps.tool.ts) |
| `get_call_journey` | Get call journey — every call between one employee and one customer mobile | [logs/getCallJourney](src/tools/definitions/callLogsService/logs/getCallJourney.tool.ts) |
| `get_my_call_logs` | Get my call logs — every call placed/received by me in a date range | [logs/getMyCallLogs](src/tools/definitions/callLogsService/logs/getMyCallLogs.tool.ts) |
| `list_calls_by_type` | List calls by type — INCOMING / OUTGOING / MISSED / CONNECTED / etc. for a user | [logs/listCallsByType](src/tools/definitions/callLogsService/logs/listCallsByType.tool.ts) |

</details>

### `employeeReportingService` (10)

<details><summary>10 tools</summary>

| Registry name | Title | Source |
| --- | --- | --- |
| `add_report_comment` | Comment on an employee report — append-only, threaded | [comments/addReportComment](src/tools/definitions/employeeReportingService/comments/addReportComment.tool.ts) |
| `list_report_comments` | List report comments — root thread on an employee report, with replies nested inline | [comments/listReportComments](src/tools/definitions/employeeReportingService/comments/listReportComments.tool.ts) |
| `get_my_report_stats` | Get my report stats — submitted-on-time / late / overdue buckets for the caller | [reports/getMyReportStats](src/tools/definitions/employeeReportingService/reports/getMyReportStats.tool.ts) |
| `get_upcoming_reports` | Get upcoming reports — pending and overdue report submissions for the caller | [reports/getUpcomingReports](src/tools/definitions/employeeReportingService/reports/getUpcomingReports.tool.ts) |
| `list_my_reports` | List my reports — paginated list of reports submitted by or owned by me | [reports/listMyReports](src/tools/definitions/employeeReportingService/reports/listMyReports.tool.ts) |
| `list_report_templates` | List report templates — reusable HTML content bodies saved by the caller | [reports/listReportTemplates](src/tools/definitions/employeeReportingService/reports/listReportTemplates.tool.ts) |
| `list_report_types` | List report types — recurring report definitions configured for the company | [reports/listReportTypes](src/tools/definitions/employeeReportingService/reports/listReportTypes.tool.ts) |
| `submit_employee_report` | Submit (or save as draft) an employee report | [reports/submitEmployeeReport](src/tools/definitions/employeeReportingService/reports/submitEmployeeReport.tool.ts) |
| `get_team_report_stats` | Get team report stats — submission rates across the team / department | [teamReports/getTeamReportStats](src/tools/definitions/employeeReportingService/teamReports/getTeamReportStats.tool.ts) |
| `list_team_reports` | List team reports — every team / department report, paginated (admin view) | [teamReports/listTeamReports](src/tools/definitions/employeeReportingService/teamReports/listTeamReports.tool.ts) |

</details>

### `attendanceService` (10)

<details><summary>10 tools</summary>

| Registry name | Title | Source |
| --- | --- | --- |
| `get_attendance_by_date` | Get attendance for a single date — every employee's check-in/out + late/productive time | [attendance/getAttendanceByDate](src/tools/definitions/attendanceService/attendance/getAttendanceByDate.tool.ts) |
| `get_attendance_range` | Get attendance over a date range — daily attendance grid for every employee | [attendance/getAttendanceRange](src/tools/definitions/attendanceService/attendance/getAttendanceRange.tool.ts) |
| `get_attendance_report` | Get detailed attendance report — per-department, per-employee, with daily status | [attendance/getAttendanceReport](src/tools/definitions/attendanceService/attendance/getAttendanceReport.tool.ts) |
| `get_attendance_stats` | Get attendance dashboard stats — totals, growth %, per-user summary | [attendance/getAttendanceStats](src/tools/definitions/attendanceService/attendance/getAttendanceStats.tool.ts) |
| `get_employee_attendance_details` | Get one employee's attendance log — daily check-in/out + leaves + holidays for a range | [attendance/getEmployeeAttendanceDetails](src/tools/definitions/attendanceService/attendance/getEmployeeAttendanceDetails.tool.ts) |
| `apply_leave` | Apply for leave — submit a new leave request (or edit an existing one) | [leave/applyLeave](src/tools/definitions/attendanceService/leave/applyLeave.tool.ts) |
| `get_company_leave_overview` | Get company leave overview — stats + enriched history of every employee's leaves (admin) | [leave/getCompanyLeaveOverview](src/tools/definitions/attendanceService/leave/getCompanyLeaveOverview.tool.ts) |
| `get_employee_leave_summary` | Get an employee's leave summary — balances + history with paginated filters (admin) | [leave/getEmployeeLeaveSummary](src/tools/definitions/attendanceService/leave/getEmployeeLeaveSummary.tool.ts) |
| `get_leave_summary` | Get my leave summary — balances per leave type + leave history in a date range | [leave/getLeaveSummary](src/tools/definitions/attendanceService/leave/getLeaveSummary.tool.ts) |
| `get_leave_types` | Get leave types — every leave type the caller can apply for | [leave/getLeaveTypes](src/tools/definitions/attendanceService/leave/getLeaveTypes.tool.ts) |

</details>

### `raiseTicketsService` (8)

<details><summary>8 tools</summary>

| Registry name | Title | Source |
| --- | --- | --- |
| `list_ticket_categories` | List ticket categories — taxonomy used to classify tickets | [categories/listTicketCategories](src/tools/definitions/raiseTicketsService/categories/listTicketCategories.tool.ts) |
| `list_ticket_comments` | List comments on a ticket — full thread | [comments/listTicketComments](src/tools/definitions/raiseTicketsService/comments/listTicketComments.tool.ts) |
| `create_ticket` | Raise a new support ticket | [tickets/createTicket](src/tools/definitions/raiseTicketsService/tickets/createTicket.tool.ts) |
| `get_ticket_by_id` | Get one ticket — full row by id | [tickets/getTicketById](src/tools/definitions/raiseTicketsService/tickets/getTicketById.tool.ts) |
| `get_ticket_counts` | Counts of tickets by operation status and category | [tickets/getTicketCounts](src/tools/definitions/raiseTicketsService/tickets/getTicketCounts.tool.ts) |
| `get_ticket_statistics` | Ticket statistics for the caller — time-series, per-category, summary | [tickets/getTicketStatistics](src/tools/definitions/raiseTicketsService/tickets/getTicketStatistics.tool.ts) |
| `list_my_assigned_tickets` | List tickets assigned to the caller — pre-formatted for dashboards | [tickets/listMyAssignedTickets](src/tools/definitions/raiseTicketsService/tickets/listMyAssignedTickets.tool.ts) |
| `list_tickets` | List support tickets — every ticket the caller can access | [tickets/listTickets](src/tools/definitions/raiseTicketsService/tickets/listTickets.tool.ts) |

</details>

### `assetsService` (5)

<details><summary>5 tools</summary>

| Registry name | Title | Source |
| --- | --- | --- |
| `get_assets_dashboard` | Asset inventory dashboard — counts, monthly activity, assignment & history snapshot | [analytics/getAssetsDashboard](src/tools/definitions/assetsService/analytics/getAssetsDashboard.tool.ts) |
| `get_asset_with_history` | Get an asset with its full audit trail — every reassignment, status change & action | [history/getAssetWithHistory](src/tools/definitions/assetsService/history/getAssetWithHistory.tool.ts) |
| `get_assigned_asset_details` | Get details of a single assigned asset — product, company, assigner, dates & serial | [inventory/getAssignedAssetDetails](src/tools/definitions/assetsService/inventory/getAssignedAssetDetails.tool.ts) |
| `get_employee_assigned_assets` | Get all assets assigned to an employee — laptops, phones, devices & more | [inventory/getEmployeeAssignedAssets](src/tools/definitions/assetsService/inventory/getEmployeeAssignedAssets.tool.ts) |
| `list_assigned_assets` | List all assigned assets — company-wide inventory with assignee, product & status | [inventory/listAssignedAssets](src/tools/definitions/assetsService/inventory/listAssignedAssets.tool.ts) |

</details>

### `todoService` (4)

<details><summary>4 tools</summary>

| Registry name | Title | Source |
| --- | --- | --- |
| `add_todo_comment` | Add a comment on a todo — append-only | [comments/addTodoComment](src/tools/definitions/todoService/comments/addTodoComment.tool.ts) |
| `create_todo` | Create a todo / personal task | [todos/createTodo](src/tools/definitions/todoService/todos/createTodo.tool.ts) |
| `get_todo_by_id` | Get todo by ID — full task detail plus its complete comment thread | [todos/getTodoById](src/tools/definitions/todoService/todos/getTodoById.tool.ts) |
| `list_todos` | List todos — every task visible to the calling user across related companies | [todos/listTodos](src/tools/definitions/todoService/todos/listTodos.tool.ts) |

</details>

### `driveService` (4)

<details><summary>4 tools</summary>

| Registry name | Title | Source |
| --- | --- | --- |
| `list_my_drive_files` | List the caller's root-level drive files & folders | [files/listMyDriveFiles](src/tools/definitions/driveService/files/listMyDriveFiles.tool.ts) |
| `list_official_documents` | List company official documents the caller can access | [files/listOfficialDocuments](src/tools/definitions/driveService/files/listOfficialDocuments.tool.ts) |
| `list_shared_files` | List drive files shared with the caller | [files/listSharedFiles](src/tools/definitions/driveService/files/listSharedFiles.tool.ts) |
| `get_drive_file_type_counts` | Get counts of the caller's drive files by type | [stats/getDriveFileTypeCounts](src/tools/definitions/driveService/stats/getDriveFileTypeCounts.tool.ts) |

</details>

### `activityCalendarService` (2)

<details><summary>2 tools</summary>

| Registry name | Title | Source |
| --- | --- | --- |
| `get_calendar_event_by_id` | Get a calendar event's details by ID — title, description, dates, type, visibility | [events/getCalendarEventById](src/tools/definitions/activityCalendarService/events/getCalendarEventById.tool.ts) |
| `list_calendar_events` | Calendar events — public (holidays, meetings, anniversaries) or private | [events/listCalendarEvents](src/tools/definitions/activityCalendarService/events/listCalendarEvents.tool.ts) |

</details>

### Core (1)

| Registry name | Title | Source |
| --- | --- | --- |
| `ping` | Ping | [ping.tool.ts](src/tools/definitions/ping.tool.ts) |

---

## Adding a new tool

1. **Identify the upstream route**: path on the API gateway, the controller, and the validation middleware (Joi). The tool input schema must mirror the Joi schema.
2. **Pick a folder**: `src/tools/definitions/<service>/<subdomain>/`. Reuse an existing service when possible; introduce a new subdomain only when the existing ones don't fit.
3. **Create the file**: `<verbCamel>.tool.ts` (e.g. `listOverdueLeads.tool.ts`).
4. **Define a Zod schema**:
   - Mirror Joi keys, types, defaults, and enums.
   - Use `z.literal` / `z.enum` for backend-strict enums.
   - Use `.describe(...)` on every field — the LLM uses these.
   - **Do not** include `signature`, `company_id`, or `company_type` in the schema (auto-injected). The exception is when the route uses Joi-strict `c_id` / `c_type` and you've set `injectCompanyContext: false` — then handle them yourself in the handler.
5. **Implement the handler**: build the body, call `apiPost(SERVICE.<NAME>/<route>, body, ctx, opts?)`, reshape the response into a typed result.
6. **Register at module bottom**: `toolRegistry.register(myTool);`.
7. **Wire side-effect imports** in the parent index files. For example, a new tool in `leadsService/crud/` needs `import "./crud/myTool.tool.js";` in [src/tools/definitions/leadsService/crud/index.ts](src/tools/definitions/leadsService/crud/index.ts) (and the parent indexes if the subdomain is new).
8. **Run `npm run typecheck`**.
9. **Verify with `/verify-tool`** — checks Joi alignment and emits a sample payload.

### Naming conventions

| Thing | Convention | Example |
| --- | --- | --- |
| File | `<verbCamel>.tool.ts` | `listOverdueLeads.tool.ts` |
| Exported tool | `<verbCamel>Tool` | `listOverdueLeadsTool` |
| Registry name | `snake_case` | `list_overdue_leads` |
| Service folder | `<name>Service` | `leadsService` |
| Subdomain folder | lowercase noun | `crud`, `analytics`, `comments` |

### Minimal example

```ts
import { z } from "zod";
import { SERVICE, apiPost } from "../../../../helpers/api.client.js";
import type { ToolDefinition } from "../../../../types/tool.types.js";
import { toolRegistry } from "../../../registry.js";

const schema = z.object({
  form_id: z.number().int().positive(),
  limit: z.number().int().min(1).max(500).default(100),
});

interface Result { count: number; ids: number[]; }

export const listOverdueLeadsTool: ToolDefinition<typeof schema, Result> = {
  name: "list_overdue_leads",
  title: "List overdue leads",
  description: "Returns leads with pending follow-up reminders past their due date.",
  inputSchema: schema,
  annotations: { readOnlyHint: true, idempotentHint: true },
  meta: { version: "1.0.0", tags: ["leads"] },
  handler: async (input, ctx) => {
    const res = await apiPost<{ data: { ids: number[] } }>(
      `${SERVICE.LEADS}/getOverdueLeads`,
      input,
      ctx,
    );
    return { count: res.data.ids.length, ids: res.data.ids };
  },
};

toolRegistry.register(listOverdueLeadsTool);
```

---

## Recurring todos

`create_todo` accepts five recurrence fields. The backend is **string-strict and case-strict** — pass exact string literals, not booleans or numbers, and not lowercase variants:

| Field | Type | Allowed values |
| --- | --- | --- |
| `recurring_type` | string | `"Weekly"` · `"Monthly"` · `"Quarterly"` (exact case) |
| `recurring_day` | string | Weekly: `"0"`–`"6"` (`"0"`=Sunday). Monthly / Quarterly: `"1"`–`"30"`. |
| `recurring_month` | string | `"1"`–`"12"`. Used only when `recurring_type === "Quarterly"`. |
| `recurring_quarter` | string | `"1"`=Jan–Mar · `"2"`=Apr–Jun · `"3"`=Jul–Sep · `"4"`=Oct–Dec. Quarterly only. |
| `recurring_date` | string | ISO `YYYY-MM-DD` of the next trigger. Weekly: next occurrence of `recurring_day`. Monthly: next occurrence of `recurring_day` in the current/next month. Quarterly: derived from `recurring_quarter` + `recurring_month` + `recurring_day`. |

The handler does no case-folding or coercion — every field is forwarded as-is. Source: [createTodo.tool.ts](src/tools/definitions/todoService/todos/createTodo.tool.ts).

---

## JSON-RPC payload example

`tools/list` request:

```json
{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
```

`tools/list` response excerpt:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "list_employees",
        "title": "Look up employees — contact info, department, manager, status & more",
        "description": "Primary employee directory — the single source of truth for all staff data...",
        "inputSchema": { "type": "object", "properties": { "...": "..." } },
        "annotations": { "readOnlyHint": true, "idempotentHint": true }
      }
    ]
  }
}
```

`tools/call` request:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_employee_by_id",
    "arguments": { "user_id": 4321 }
  }
}
```

`tools/call` success response:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      { "type": "text", "text": "{\"id\":4321,\"name\":\"Asha Verma\",\"...\":\"...\"}" }
    ],
    "isError": false
  }
}
```

`tools/call` failure response (validation):

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      { "type": "text", "text": "[VALIDATION] Invalid input for tool \"get_employee_by_id\". [...]" }
    ],
    "isError": true
  }
}
```

Every request must include `Authorization: Bearer <mcp_access_token>`. There is no anonymous access path.

---

## Development

### npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | `tsx watch --env-file=.env src/index.ts` — fast restart loop |
| `npm run typecheck` | `tsc --noEmit` — must be clean before opening a PR |
| `npm run build` | clean → `tsc` → `tsx src/scripts/postbuild.ts` |
| `npm run start` | `npm run migrate && node dist/index.js` |
| `npm run prod` | `build` then `start` |
| `npm run migrate` | `sequelize-cli db:migrate` (paths in `.sequelizerc`) |
| `npm run migrate:undo` | `sequelize-cli db:migrate:undo` |
| `npm run vercel-build` | migrations + build (used by Vercel) |

### TypeScript settings

`tsconfig.json` enables `strict`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noImplicitReturns`. `module: NodeNext`, `target: ES2022`, ESM only — **all relative imports must include the `.js` suffix**, even when importing `.ts` source.

### Errors

Every thrown error must extend `BaseError` (see [src/errors/base.errors.ts](src/errors/base.errors.ts)). The Express global error handler ([src/utils/error-handler.ts](src/utils/error-handler.ts)) serializes by severity, redacts sensitive fields in production, and assigns each response an `errorId`.

Tool handlers can throw plain `Error`s — the executor catches them and returns `ToolOutcome { ok: false, code: "HANDLER" }`. A clean throw with `[CODE] message` style is preferred so the MCP error text is human-readable.

---

## Contributing

### Branches

Feature branches off `main`, named `<type>/<scope>` (e.g. `feat/leadsService`, `fix/helpers`). PRs target `main`.

### Commit messages

Conventional Commits: `<type>(<scope>): <message>`.

- **Types**: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `build`.
- **Scopes** (active list): `drive`, `tickets`, `call-logs`, `todo`, `leadsService`, `tools`, `mcp`, `user`, `helpers`, `ers`, `mcp-oauth`, `oauth`, `auth`, `leaves`, `analytics`, `calendar`, `assets`, `employeeReportingService`, `attendance`, `activityCalendarService`, `deploy`. Recent trend: `feat(<service>Service): …`.
- **Subject**: lowercase, imperative, no trailing period, ≤ 70 chars including the prefix.

Examples:
- `feat(leadsService): add list_overdue_leads tool`
- `fix(helpers): pass injectCompanyContext through apiPost retries`
- `refactor(tools): extract pickFirst to shared helper`

`/commit-msg` (local slash command) generates a compliant message from staged changes.

### PR checklist

- [ ] `npm run typecheck` is clean
- [ ] No `signature` / `company_id` / `company_type` in any tool's `inputSchema`
- [ ] New tool's registry name is unique (`grep -r 'toolRegistry.register' src/tools/definitions`)
- [ ] All relative imports include the `.js` suffix
- [ ] README **Available tools** table updated when adding/removing/renaming a tool
- [ ] Conventional Commits message
