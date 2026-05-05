import { Model, DataTypes, type Sequelize } from "sequelize";

export class RequestLogs extends Model {
  declare req_id: string;
  declare method: string;
  declare path: string;
  declare status: number;
  declare duration_ms: number;
  declare ip: string | null;
  declare level: string;
  declare error_message: string | null;
  declare error_stack: string | null;
  declare user_id: string | null;
  declare tool_name: string | null;
  declare created_at: Date;

  static associate(_: any) {}

  static initModel(sequelize: Sequelize) {
    return RequestLogs.init(
      {
        req_id: {
          type: DataTypes.STRING(36),
          primaryKey: true,
          allowNull: false,
        },
        method: {
          type: DataTypes.STRING(10),
          allowNull: false,
        },
        path: {
          type: DataTypes.STRING(500),
          allowNull: false,
        },
        status: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        duration_ms: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        ip: {
          type: DataTypes.STRING(45),
          allowNull: true,
        },
        level: {
          type: DataTypes.STRING(10),
          allowNull: false,
        },
        error_message: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        error_stack: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        user_id: {
          type: DataTypes.STRING(255),
          allowNull: true,
        },
        tool_name: {
          type: DataTypes.STRING(100),
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
        tableName: "t_request_logs",
        underscored: true,
        timestamps: false,
      },
    );
  }
}
