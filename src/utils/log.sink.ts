import { Writable } from "stream";

import config from "../config/env.js";
import { getLogCollection } from "../config/mongo.js";

const LEVEL_VALUES: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const MAX_FIELD_BYTES = 2048;
const BUFFER_MAX = 256;

interface PinoRecord {
  time?: number | string;
  level?: number | string;
  msg?: string;
  reqId?: string;
  err?: Record<string, unknown>;
  [key: string]: unknown;
}

function truncate(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (Buffer.byteLength(value, "utf8") <= MAX_FIELD_BYTES) return value;
  return value.slice(0, MAX_FIELD_BYTES) + "…";
}

function walk(node: unknown, depth = 0): unknown {
  if (depth > 4) return undefined;
  if (node === null || node === undefined) return node;
  if (typeof node === "string") return truncate(node);
  if (typeof node !== "object") return node;
  if (Array.isArray(node))
    return node.slice(0, 50).map((v) => walk(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    out[k] = walk(v, depth + 1);
  }
  return out;
}

function buildDoc(record: PinoRecord): Record<string, unknown> {
  const ts =
    typeof record.time === "number"
      ? new Date(record.time)
      : typeof record.time === "string"
        ? new Date(record.time)
        : new Date();
  const level =
    typeof record.level === "string"
      ? record.level
      : typeof record.level === "number"
        ? Object.entries(LEVEL_VALUES).find(([, v]) => v === record.level)?.[0]
        : undefined;

  const {
    time: _time,
    level: _level,
    msg,
    app,
    env,
    reqId,
    err,
    ...rest
  } = record;

  const doc: Record<string, unknown> = {
    ts,
    level: level ?? "info",
    app,
    env,
    msg,
  };

  if (reqId) doc["reqId"] = reqId;
  if (err && typeof err === "object") doc["err"] = walk(err) as object;

  const ctx = walk(rest);
  if (ctx && typeof ctx === "object" && Object.keys(ctx).length > 0) {
    doc["ctx"] = ctx;
  }

  return doc;
}

export function createMongoLogSink(): Writable {
  const threshold = LEVEL_VALUES[config.logging.mongo.level] ?? 50;
  const pending: Record<string, unknown>[] = [];
  let collectionReady = false;
  let collection: Awaited<ReturnType<typeof getLogCollection>> = null;

  getLogCollection()
    .then((coll) => {
      collection = coll;
      collectionReady = true;
      if (coll && pending.length > 0) {
        const batch = pending.splice(0, pending.length);
        coll.insertMany(batch, { ordered: false }).catch(() => {});
      }
    })
    .catch(() => {
      collectionReady = true;
    });

  const sink = new Writable({
    write(chunk, _enc, cb): void {
      cb();
      try {
        const line = chunk.toString("utf8");
        const record = JSON.parse(line) as PinoRecord;

        const recordLevel =
          typeof record.level === "number"
            ? record.level
            : (LEVEL_VALUES[String(record.level)] ?? 0);

        if (recordLevel < threshold) return;

        const doc = buildDoc(record);

        if (!collectionReady) {
          if (pending.length >= BUFFER_MAX) pending.shift();
          pending.push(doc);
          return;
        }

        if (collection) {
          collection.insertOne(doc).catch();
        }
      } catch {}
    },
  });

  return sink;
}
