import { Model, DataTypes, type Sequelize } from "sequelize";

export class McpAuthCache extends Model {
  declare token_hash: string;
  declare email: string;
  declare user_id: number;
  declare company_id: number;
  declare company_type: string;
  declare role_char: string;
  declare cached_jwt: string;
  declare cached_signature: string;
  declare created_at: Date;
  declare expires_at: Date;

  static associate(_: any) {}

  isExpired() {
    return new Date() > new Date(this.expires_at);
  }

  static initModel(sequelize: Sequelize) {
    return McpAuthCache.init(
      {
        token_hash: {
          type: DataTypes.STRING(64),
          primaryKey: true,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        company_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        company_type: {
          type: DataTypes.STRING(32),
          allowNull: false,
        },
        role_char: {
          type: DataTypes.STRING(8),
          allowNull: false,
        },
        cached_jwt: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        cached_signature: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
        expires_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: "mcp_auth_cache",
        underscored: true,
        timestamps: false,
      },
    );
  }
}
