"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("mcp_access_tokens", "client_name_slug", {
      type: Sequelize.STRING(64),
      allowNull: false,
      defaultValue: "mcp-client",
    });

    await queryInterface.addIndex(
      "mcp_access_tokens",
      ["client_name_slug"],
      { name: "idx_access_tokens_client_name_slug" },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      "mcp_access_tokens",
      "idx_access_tokens_client_name_slug",
    );
    await queryInterface.removeColumn("mcp_access_tokens", "client_name_slug");
  },
};
