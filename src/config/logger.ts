import pino, { type Logger } from "pino";
import pretty from "pino-pretty";
import config from "./env.js";

const prettyStream = pretty({
  colorize: true,
  translateTime: "SYS:HH:MM:ss",
  ignore: "pid,hostname",
  sync: true,
});

const devStreams: pino.StreamEntry[] = [
  { level: "trace", stream: prettyStream }, // all logs → pretty console
  { level: "error", stream: process.stderr }, // error + fatal → stderr as well
];

const prodStreams: pino.StreamEntry[] = [
  { level: "info", stream: process.stdout }, // info+ → stdout (Datadog/Loki picks up)
  { level: "error", stream: process.stderr }, // error+ → stderr
  // Uncomment once pino-mongodb is set up:
  // { level: "warn", stream: await buildMongoStream() },
];

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
  pino.multistream(
    config.app.isDev ? devStreams : prodStreams,
    { dedupe: true }, // if multiple streams share a level, only write once
  ),
);

export default logger;
