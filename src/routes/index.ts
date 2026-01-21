import { Router, type Router as ExpressRouter } from "express";
import documentsRouter from "./document.routes.js";

export const router: ExpressRouter = Router();

router.use("/documents", documentsRouter);
