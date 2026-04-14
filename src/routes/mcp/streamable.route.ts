import { Router } from "express";
import {
  streamablePostHandler,
  streamableGetHandler,
  streamableDeleteHandler,
} from "../../mcp/handlers/streamable.handler.js";

const router = Router();

router.post("/", (req, res, next) =>
  streamablePostHandler(req, res).catch(next),
);

router.get("/", (req, res, next) => streamableGetHandler(req, res).catch(next));

router.delete("/", (req, res, next) =>
  streamableDeleteHandler(req, res).catch(next),
);

export default router;
