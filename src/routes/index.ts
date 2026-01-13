import { Router, type Router as ExpressRouter } from "express";
import { invoicesRouter } from "./invoices.routes.js";
import { webhooksRouter } from "./webhooks.routes.js";

export const router: ExpressRouter = Router();

router.use("/invoices", invoicesRouter);
router.use("/webhooks", webhooksRouter);
