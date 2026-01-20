import { Router, type Router as ExpressRouter } from "express";
import documentsRouter from "./document.routes.js";
import { webhooksRouter } from "./webhooks.routes.js";

export const router: ExpressRouter = Router();

router.use("/documents", documentsRouter);
router.use("/webhooks", webhooksRouter);
