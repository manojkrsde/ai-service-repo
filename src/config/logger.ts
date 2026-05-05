import pino, { type Logger } from "pino";
import config from "./env.js";

let prettyStream: pino.DestinationStream | undefined;

if (config.app.isDev) {
  const pretty = (await import("pino-pretty")).default;
  prettyStream = pretty({
    colorize: true,
    translateTime: "SYS:HH:MM:ss",
    ignore: "pid,hostname",
    sync: true,
  });
}

const streams: pino.StreamEntry[] = prettyStream
  ? [
      { level: "trace", stream: prettyStream },
      { level: "error", stream: process.stderr },
    ]
  : [
      { level: config.logging.level, stream: process.stdout },
      { level: "error", stream: process.stderr },
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
