import express, { type Express } from "express";
import { StatusCodes } from "http-status-codes";

import config from "./config/env.js";
import logger from "./config/logger.js";
import { stripTrailingSlash } from "./helpers/trailing.slash.js";
import { globalErrorHandler, notFoundHandler } from "./utils/error-handler.js";

import router from "./routes/index.js";

const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(stripTrailingSlash);

app.get("/health", (_req, res): void => {
  res.status(StatusCodes.OK).json({
    success: true,
    message: "Server is healthy.",
    meta: {
      name: config.app.name,
      env: config.app.env,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

app.use("/", router);

app.use(notFoundHandler);
app.use(globalErrorHandler);

const start = async (): Promise<void> => {
  const server = app.listen(config.app.port, () => {
    logger.info(
      {
        name: config.app.name,
        env: config.app.env,
        port: config.app.port,
        baseUrl: config.app.baseUrl,
      },
      "Server started",
    );
  });

  const shutdown = (signal: string): void => {
    logger.warn({ signal }, "Shutdown signal received");

    server.close((err: Error | undefined) => {
      if (err !== undefined) {
        logger.error({ err }, "Error during server shutdown");
        process.exit(1);
      }
      logger.info("Server shut down gracefully");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Shutdown timed out — forcing exit");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
};

process.on("uncaughtException", (err: Error): void => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown): void => {
  logger.fatal({ reason }, "Unhandled promise rejection — shutting down");
  process.exit(1);
});

if (process.env["VERCEL"] !== "1") {
  start().catch((err: unknown): void => {
    logger.fatal({ err }, "Fatal error during startup");
    process.exit(1);
  });
}

export default app;
