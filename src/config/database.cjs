require("dotenv").config();

module.exports = {
  development: {
    url:
      process.env.DATABASE_URL_LOCAL ||
      "postgres://postgres:123456@localhost:5432/mcp_database",
    dialect: "postgres",
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  },
  staging: {
    url: process.env.DATABASE_URL_STAGING,
    dialect: "postgres",
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
  production: {
    url: process.env.DATABASE_URL_PROD,
    dialect: "postgres",
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
