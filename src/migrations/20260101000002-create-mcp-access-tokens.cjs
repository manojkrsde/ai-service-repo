"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("mcp_access_tokens", {
      token: {
        type: Sequelize.STRING(128),
        primaryKey: true,
        allowNull: false,
        comment: "crypto random hex, stored directly",
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      company_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
        comment: "Primary | Secondary",
      },
      role_char: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      client_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: "e.g. claudeai, cursor",
      },
      scopes: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: ["*"],
      },
      revoked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      last_used_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "Updated async, not on every call",
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: "NULL = never expires",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    await queryInterface.addIndex("mcp_access_tokens", ["token"], {
      name: "idx_access_tokens_token_active",
      unique: true,
      where: { revoked: false },
    });

    await queryInterface.addIndex("mcp_access_tokens", ["user_id"], {
      name: "idx_access_tokens_user_id",
    });

    await queryInterface.addIndex("mcp_access_tokens", ["email"], {
      name: "idx_access_tokens_email",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("mcp_access_tokens");
  },
};
