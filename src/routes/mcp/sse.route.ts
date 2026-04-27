import { Router } from "express";
import {
  sseGetHandler,
  ssePostMessageHandler,
} from "../../mcp/handlers/sse.handler.js";

const router = Router();

// Establishing the Server-Sent Events stream
router.get("/sse", (req, res, next) => sseGetHandler(req, res).catch(next));

// Receiving JSON-RPC messages from clients
router.post("/messages", (req, res, next) =>
  ssePostMessageHandler(req, res).catch(next),
);

export default router;
