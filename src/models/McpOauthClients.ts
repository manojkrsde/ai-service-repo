import { Model, DataTypes, type Sequelize } from "sequelize";

export class McpOauthClients extends Model {
  declare client_id: string;
  declare client_name: string;
  declare client_name_slug: string;
  declare redirect_uris: string[];
  declare created_at: Date;

  static associate(_: any) {}

  static initModel(sequelize: Sequelize) {
    return McpOauthClients.init(
      {
        client_id: {
          type: DataTypes.STRING(255),
          primaryKey: true,
          allowNull: false,
        },
        client_name: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        client_name_slug: {
          type: DataTypes.STRING(64),
          allowNull: false,
        },
        redirect_uris: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: [],
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "mcp_oauth_clients",
        underscored: true,
        timestamps: false,
      },
    );
  }
}
