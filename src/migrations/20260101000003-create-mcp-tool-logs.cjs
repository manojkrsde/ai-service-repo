"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("mcp_tool_logs", {
      id: {
        type: Sequelize.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      tool_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      client_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: "claudeai | cursor",
      },
      status: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: "success | error",
      },
      error_code: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: "e.g. 401, TIMEOUT",
      },
      duration_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      called_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    await queryInterface.addIndex("mcp_tool_logs", ["user_id", "called_at"], {
      name: "idx_tool_logs_user_id_called_at",
    });

    await queryInterface.addIndex("mcp_tool_logs", ["called_at"], {
      name: "idx_tool_logs_called_at",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("mcp_tool_logs");
  },
};
