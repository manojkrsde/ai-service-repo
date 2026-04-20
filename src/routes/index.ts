import { Router } from "express";
import mcpRouter from "./mcp/index.js";
import oauthRouter from "./oauth/routes.js";

const router = Router();

// OAuth 2.1 endpoints for MCP client discovery
router.use("/", oauthRouter);

// MCP Streamable HTTP endpoint
router.use("/mcp", mcpRouter);

export default router;
