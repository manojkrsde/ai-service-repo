import { Model, DataTypes, type Sequelize } from "sequelize";

export class McpAccessTokens extends Model {
  declare token: string;
  declare email: string;
  declare user_id: number;
  declare company_id: number;
  declare company_type: string;
  declare role_char: string;
  declare client_id: string;
  declare client_name_slug: string;
  declare scopes: any;
  declare revoked: boolean;
  declare last_used_at: Date | null;
  declare expires_at: Date | null;
  declare created_at: Date;

  static associate(_: any) {}

  isExpired() {
    if (!this.expires_at) return false;
    return new Date() > new Date(this.expires_at);
  }

  isValid() {
    return !this.revoked && !this.isExpired();
  }

  async touchLastUsed() {
    await this.update({ last_used_at: new Date() });
  }

  static initModel(sequelize: Sequelize) {
    return McpAccessTokens.init(
      {
        token: {
          type: DataTypes.STRING(128),
          primaryKey: true,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING(255),
          allowNull: false,
          validate: { isEmail: true },
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
          type: DataTypes.STRING(20),
          allowNull: false,
          validate: {
            isIn: [["Primary", "Secondary"]],
          },
        },
        role_char: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },
        client_id: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        client_name_slug: {
          type: DataTypes.STRING(64),
          allowNull: false,
          defaultValue: "mcp-client",
        },
        scopes: {
          type: DataTypes.JSONB,
          allowNull: false,
          defaultValue: ["*"],
        },
        revoked: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        last_used_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        expires_at: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "mcp_access_tokens",
        underscored: true,
        timestamps: false,
      },
    );
  }
}
