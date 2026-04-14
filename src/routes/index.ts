import { Router } from "express";
import mcpRouter from "./mcp/index.js";

const router = Router();

router.use("/mcp", mcpRouter);
// router.use("/api/v1", apiRouter);  ← future

export default router;
