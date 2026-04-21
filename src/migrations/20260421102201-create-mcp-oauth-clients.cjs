"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("mcp_oauth_clients", {
      client_id: {
        type: Sequelize.STRING(255),
        primaryKey: true,
        allowNull: false,
      },
      client_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      client_name_slug: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      redirect_uris: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("NOW()"),
      },
    });

    await queryInterface.addIndex("mcp_oauth_clients", ["client_name_slug"], {
      name: "idx_oauth_clients_client_name_slug",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("mcp_oauth_clients");
  },
};
