import { Router } from "express";
import streamableRouter from "./streamable.route.js";
import sseRouter from "./sse.route.js";

const router = Router();

router.use("/", streamableRouter);

// Traditional HTTP + SSE for older clients and LangChain setups
router.use("/", sseRouter);

export default router;
