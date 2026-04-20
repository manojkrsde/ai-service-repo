import { Model, DataTypes, type Sequelize } from "sequelize";

export class McpToolLogs extends Model {
  declare id: number;
  declare user_id: number;
  declare email: string;
  declare tool_name: string;
  declare client_id: string | null;
  declare status: string;
  declare error_code: string | null;
  declare duration_ms: number | null;
  declare called_at: Date;

  static associate(_: any) {}

  static async record({
    user_id,
    email,
    tool_name,
    client_id,
    status,
    error_code,
    duration_ms,
  }: {
    user_id: number;
    email: string;
    tool_name: string;
    client_id?: string | null;
    status: string;
    error_code?: string | null;
    duration_ms?: number | null;
  }) {
    try {
      await McpToolLogs.create({
        user_id,
        email,
        tool_name,
        client_id: client_id || null,
        status,
        error_code: error_code || null,
        duration_ms: duration_ms || null,
        called_at: new Date(),
      });
    } catch (err) {
      if (err instanceof Error) {
        console.error("[McpToolLog] Failed to write log:", err.message);
      }
    }
  }

  static initModel(sequelize: Sequelize) {
    return McpToolLogs.init(
      {
        id: {
          type: DataTypes.BIGINT,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false,
        },
        user_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING(255),
          allowNull: false,
        },
        tool_name: {
          type: DataTypes.STRING(100),
          allowNull: false,
        },
        client_id: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        status: {
          type: DataTypes.STRING(10),
          allowNull: false,
          validate: {
            isIn: [["success", "error"]],
          },
        },
        error_code: {
          type: DataTypes.STRING(50),
          allowNull: true,
        },
        duration_ms: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        called_at: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: DataTypes.NOW,
        },
      },
      {
        sequelize,
        tableName: "mcp_tool_logs",
        underscored: true,
        timestamps: false,
      },
    );
  }
}
