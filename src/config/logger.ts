import pino, { type Logger } from "pino";
import pretty from "pino-pretty";
import config from "./env.js";
import { createMongoLogSink } from "../utils/log.sink.js";

const prettyStream = pretty({
  colorize: true,
  translateTime: "SYS:HH:MM:ss",
  ignore: "pid,hostname",
  sync: true,
});

const streams: pino.StreamEntry[] = config.app.isDev
  ? [{ level: "trace", stream: prettyStream }]
  : [
      { level: "info", stream: process.stdout },
      { level: "error", stream: process.stderr },
    ];

if (config.logging.mongo.uri) {
  streams.push({
    level: config.logging.mongo.level,
    stream: createMongoLogSink(),
  });
}

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
      paths: [
        "*.password",
        "*.token",
        "*.secret",
        "*.authorization",
        "*.jwt",
        "*.jwtToken",
        "*.accessToken",
        "*.cachedToken",
        "*.cachedJwt",
        "*.cachedSignature",
        "*.signature",
        "req.headers.authorization",
        "req.headers.cookie",
      ],
      censor: "[REDACTED]",
    },
  },
  pino.multistream(streams, { dedupe: true }),
);

export default logger;
