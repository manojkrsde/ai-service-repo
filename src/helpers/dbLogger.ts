import db from "../models/index.js";

export interface RequestLogData {
  reqId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ip: string | undefined;
  level: string;
  errorMessage?: string | undefined;
  errorStack?: string | undefined;
  userId?: string | undefined;
  toolName?: string | undefined;
}

export const logRequest = (data: RequestLogData): void => {
  db.RequestLogs.create({
    req_id: data.reqId,
    method: data.method,
    path: data.path,
    status: data.status,
    duration_ms: data.durationMs,
    ip: data.ip ?? null,
    level: data.level,
    error_message: data.errorMessage ?? null,
    error_stack: data.status >= 400 ? (data.errorStack ?? null) : null,
    user_id: data.userId ?? null,
    tool_name: data.toolName ?? null,
  }).catch(() => {});
};
