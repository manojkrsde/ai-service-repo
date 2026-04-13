/**
 * Centralized environment configuration
 * - Loads & validates all env variables
 * - Provides defaults + strict type safety
 * - Single source of truth across all environments
 */
import dotenv from "dotenv";
import { str, int, url, enumerator } from "../helpers/env.helper.js";
dotenv.config();

// Types
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
    url: url("DATABASE_URL", ""),
    host: str("DB_HOST", "localhost"),
    port: int("DB_PORT", 5432),
    name: str("DB_NAME", "app_db"),
    user: str("DB_USER", "postgres"),
    password: str("DB_PASSWORD", ""),
  },

  auth: {
    jwtSecret: str("JWT_SECRET", "secret"),
    jwtExpiry: str("JWT_EXPIRY", "7d"),
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
  },
} as const;

export type AppConfig = typeof config;
export default config;
