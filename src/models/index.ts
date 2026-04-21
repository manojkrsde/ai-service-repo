import pg from "pg";
import { Sequelize } from "sequelize";
import configEnv from "../config/env.js";

import { McpAccessTokens } from "./McpAccessTokens.js";
import { McpAuthCache } from "./McpAuthCache.js";
import { McpAuthCodes } from "./McpAuthCodes.js";
import { McpOauthClients } from "./McpOauthClients.js";
import { McpToolLogs } from "./McpToolLogs.js";

const env = configEnv.app.env as "development" | "staging" | "production";
const dbUrl =
  env === "production"
    ? configEnv.database.url_prod
    : env === "staging"
      ? configEnv.database.url_staging
      : configEnv.database.url_local;

const sequelize = new Sequelize(
  dbUrl || "postgres://postgres:123456@localhost:5432/ai_db",
  {
    dialect: "postgres",
    dialectModule: pg,
    logging: false,
    pool: {
      max: 20,
      min: 0,
      acquire: 60000,
      idle: 10000,
    },
  },
);

const db = {
  sequelize,
  Sequelize,
  McpAccessTokens: McpAccessTokens.initModel(sequelize),
  McpAuthCache: McpAuthCache.initModel(sequelize),
  McpAuthCodes: McpAuthCodes.initModel(sequelize),
  McpOauthClients: McpOauthClients.initModel(sequelize),
  McpToolLogs: McpToolLogs.initModel(sequelize),
};

Object.values(db).forEach((model: any) => {
  if (model.associate) {
    model.associate(db);
  }
});

export default db;

export {
  sequelize,
  Sequelize,
  McpAccessTokens,
  McpAuthCache,
  McpAuthCodes,
  McpOauthClients,
  McpToolLogs,
};
