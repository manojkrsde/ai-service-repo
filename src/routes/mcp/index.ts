import { Router } from "express";
import streamableRouter from "./streamable.route.js";

const router = Router();

router.use("/", streamableRouter);

// router.use("/mcp", sseRouter);  ← traditional http + sse, future

export default router;
