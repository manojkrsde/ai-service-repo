import { Model, DataTypes, type Sequelize } from "sequelize";

export class McpAuthCodes extends Model {
  declare code: string;
  declare email: string;
  declare user_id: number;
  declare company_id: number;
  declare company_type: string;
  declare role_char: string;
  declare client_id: string;
  declare redirect_uri: string;
  declare code_challenge: string;
  declare code_challenge_method: string;
  declare used: boolean;
  declare expires_at: Date;
  declare created_at: Date;

  static associate(_: any) {}

  isExpired() {
    return new Date() > new Date(this.expires_at);
  }

  isValid() {
    return !this.used && !this.isExpired();
  }

  static initModel(sequelize: Sequelize) {
    return McpAuthCodes.init(
      {
        code: {
          type: DataTypes.STRING(64),
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
        },
        role_char: {
          type: DataTypes.STRING(50),
          allowNull: false,
        },
        client_id: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        redirect_uri: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        code_challenge: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        code_challenge_method: {
          type: DataTypes.STRING(10),
          allowNull: false,
          defaultValue: "S256",
        },
        used: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        expires_at: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        created_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "mcp_auth_codes",
        underscored: true,
        timestamps: false,
      },
    );
  }
}
