"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("t_request_logs", {
      req_id: {
        type: Sequelize.STRING(36),
        primaryKey: true,
        allowNull: false,
        comment: "UUID from x-request-id header or generated",
      },
      method: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: "GET | POST | PUT | DELETE etc.",
      },
      path: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      status: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: "HTTP status code",
      },
      duration_ms: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      ip: {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: "Client IP — supports IPv6",
      },
      level: {
        type: Sequelize.STRING(10),
        allowNull: false,
        comment: "info | warn | error",
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Error message string — populated on 4xx/5xx",
      },
      error_stack: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: "Stack trace — ONLY populated on 5xx",
      },
      user_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: "User ID from decoded JWT if available",
      },
      tool_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: "MCP tool name from tools/call requests",
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    await queryInterface.addIndex("t_request_logs", ["created_at"], {
      name: "idx_request_logs_created_at",
    });

    await queryInterface.addIndex("t_request_logs", ["status"], {
      name: "idx_request_logs_status",
    });

    await queryInterface.addIndex("t_request_logs", ["level"], {
      name: "idx_request_logs_level",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("t_request_logs");
  },
};
