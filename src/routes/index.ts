import { Router, type Router as ExpressRouter } from "express";
import { requireGlobalApiKey } from "../middleware/api-key.middleware.js";
import clientsRouter from "./client.routes.js";
import documentsRouter from "./document.routes.js";

export const router: ExpressRouter = Router();

router.use("/clients", requireGlobalApiKey, clientsRouter);
router.use("/documents", documentsRouter);
