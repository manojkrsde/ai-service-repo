import cors from "cors";
import type { CorsOptions, CorsOptionsDelegate } from "cors";

import config from "./env.js";

const rawOrigins = config.security.corsAllowedOrigins.trim();
const allowAll = rawOrigins === "" || rawOrigins === "*";
const allowList: string[] | null = allowAll
  ? null
  : rawOrigins
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);

const baseOptions: Omit<CorsOptions, "origin"> = {
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Request-ID",
    "Accept",
    "Mcp-Session-Id",
    "Mcp-Protocol-Version",
    "Last-Event-ID",
  ],
  exposedHeaders: [
    "X-Request-ID",
    "Mcp-Session-Id",
    "WWW-Authenticate",
    "Retry-After",
    "RateLimit-Limit",
    "RateLimit-Remaining",
    "RateLimit-Reset",
  ],
  credentials: true,
  maxAge: 86_400,
  optionsSuccessStatus: 204,
};

const delegate: CorsOptionsDelegate = (req, callback) => {
  const origin = req.headers.origin;

  if (allowAll || origin === undefined) {
    callback(null, { ...baseOptions, origin: true });
    return;
  }

  if (allowList !== null && allowList.includes(origin)) {
    callback(null, { ...baseOptions, origin: true });
    return;
  }

  callback(null, { ...baseOptions, origin: false });
};

export default cors(delegate);
