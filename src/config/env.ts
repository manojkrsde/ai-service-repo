import dotenv from "dotenv";
import { str, int, url, enumerator } from "../helpers/env.helper.js";
dotenv.config();

type Environment = "development" | "production" | "test";
type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

const ENV_VALUES: readonly Environment[] = [
  "development",
  "production",
  "test",
];
const LOG_LEVEL_VALUES: readonly LogLevel[] = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
];

const config = {
  app: {
    name: str("APP_NAME", "ai-services"),
    env: enumerator<Environment>("NODE_ENV", "development", ENV_VALUES),
    port: int("PORT", 8099),
    baseUrl: url("BASE_URL", "http://localhost:8099"),
    isDev: str("NODE_ENV", "development") === "development",
    isProd: str("NODE_ENV", "development") === "production",
  },

  database: {
    url_local: url("DATABASE_URL_LOCAL", ""),
    url_staging: url("DATABASE_URL_STAGING", ""),
    url_prod: url("DATABASE_URL_PROD", ""),
  },

  auth: {
    jwtSecretKey: str("JWT_SECRET_KEY", "lakheragroupservices"),
    jwtExpiry: str("JWT_EXPIRY", "7d"),
  },

  oauth: {
    mcpServiceKey: str("MCP_SERVICE_KEY", ""),
  },

  services: {
    apiGateway: url("API_GATEWAY_URL", "http://localhost:8002"),
  },

  cache: {
    redisUrl: url("REDIS_URL", ""),
  },

  queue: {
    rabbitmqUrl: url("RABBITMQ_URL", ""),
  },

  storage: {
    cloudinaryUrl: url("CLOUDINARY_URL", ""),
  },

  logging: {
    level: enumerator<LogLevel>("LOG_LEVEL", "info", LOG_LEVEL_VALUES),
    slowRequestMs: int("SLOW_REQUEST_MS", 5000),
  },

  security: {
    corsAllowedOrigins: str("CORS_ALLOWED_ORIGINS", "*"),
    trustProxy: int("TRUST_PROXY_HOPS", 1),
    rateLimit: {
      generalMax: int("RATE_LIMIT_GENERAL_MAX", 1000),
      generalWindowMs: int("RATE_LIMIT_GENERAL_WINDOW_MS", 60_000),
      authMax: int("RATE_LIMIT_AUTH_MAX", 10),
      authWindowMs: int("RATE_LIMIT_AUTH_WINDOW_MS", 15 * 60_000),
      heavyMax: int("RATE_LIMIT_HEAVY_MAX", 50),
      heavyWindowMs: int("RATE_LIMIT_HEAVY_WINDOW_MS", 60 * 60_000),
    },
  },
} as const;

export type AppConfig = typeof config;
export default config;
