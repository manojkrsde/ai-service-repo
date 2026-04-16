"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("mcp_auth_codes", {
      code: {
        type: Sequelize.STRING(64),
        primaryKey: true,
        allowNull: false,
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
      redirect_uri: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      code_challenge: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: "SHA256(code_verifier) for PKCE",
      },
      code_challenge_method: {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: "S256",
      },
      used: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: "created_at + 10 minutes",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    await queryInterface.addIndex("mcp_auth_codes", ["expires_at"], {
      name: "idx_auth_codes_expires_at",
    });

    await queryInterface.addIndex("mcp_auth_codes", ["used"], {
      name: "idx_auth_codes_used",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("mcp_auth_codes");
  },
};
