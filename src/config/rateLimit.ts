import { rateLimit, type Options } from "express-rate-limit";
import { StatusCodes } from "http-status-codes";

import config from "./env.js";

const createLimiter = (overrides: Partial<Options>) =>
  rateLimit({
    validate: { trustProxy: true },
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) =>
      req.path === "/health" || req.path.startsWith("/.well-known/"),
    handler: (_req, res) => {
      res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        success: false,
        message: "Too many requests — please try again later.",
      });
    },
    ...overrides,
  });

export const generalLimiter = createLimiter({
  windowMs: config.security.rateLimit.generalWindowMs,
  limit: config.security.rateLimit.generalMax,
});

export const authLimiter = createLimiter({
  windowMs: config.security.rateLimit.authWindowMs,
  limit: config.security.rateLimit.authMax,
  skipSuccessfulRequests: true,
});

export const heavyLimiter = createLimiter({
  windowMs: config.security.rateLimit.heavyWindowMs,
  limit: config.security.rateLimit.heavyMax,
});
