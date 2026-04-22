"use strict";

/**
 * Adds cached_jwt and cached_signature to mcp_access_tokens.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("mcp_access_tokens", "cached_jwt", {
      type: Sequelize.DataTypes.TEXT,
      allowNull: true,
    });
    await queryInterface.addColumn("mcp_access_tokens", "cached_signature", {
      type: Sequelize.DataTypes.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("mcp_access_tokens", "cached_jwt");
    await queryInterface.removeColumn("mcp_access_tokens", "cached_signature");
  },
};
