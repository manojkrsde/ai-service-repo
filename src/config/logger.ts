import pino, { type Logger } from "pino";
import pretty from "pino-pretty";
import config from "./env.js";

const devStream = pretty({
  colorize: true,
  translateTime: "SYS:HH:MM:ss",
  ignore: "pid,hostname",
  sync: true,
});

// ─── Prod Transport ───────────────────────────────────────────────────────────
// Raw JSON to stdout — ingestible by Datadog, Loki, CloudWatch, etc.
// Uncomment DB transport once pino-mongodb is configured:
//
// const prodTransport = pino.transport({
//   targets: [
//     {
//       target:  "pino-mongodb",
//       level:   "warn",
//       options: {
//         uri:        config.database.url,
//         database:   config.database.name,
//         collection: "logs",
//       },
//     },
//     {
//       target:  "pino/file",
//       level:   "info",
//       options: { dest: 1 }, // stdout
//     },
//   ],
// });

// ─── Logger ───────────────────────────────────────────────────────────────────

const logger: Logger = pino(
  {
    level: config.logging.level,
    base: {
      app: config.app.name,
      env: config.app.env,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    redact: {
      paths: ["*.password", "*.token", "*.secret", "*.authorization"],
      censor: "[REDACTED]",
    },
  },
  config.app.isDev ? devStream : process.stdout,
);

export default logger;
