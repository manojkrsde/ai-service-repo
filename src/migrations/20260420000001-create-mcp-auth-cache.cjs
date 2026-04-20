"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("mcp_auth_cache", {
      token_hash: {
        type: Sequelize.STRING(64),
        primaryKey: true,
        allowNull: false,
        comment: "sha256 of Bearer access token",
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
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      role_char: {
        type: Sequelize.STRING(8),
        allowNull: false,
      },
      cached_jwt: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      cached_signature: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex("mcp_auth_cache", ["expires_at"], {
      name: "idx_mcp_auth_cache_expires",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("mcp_auth_cache");
  },
};
