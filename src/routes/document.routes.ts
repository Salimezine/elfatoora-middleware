import type { Router as ExpressRouter } from "express";
import { Router } from "express";
import {
  createDocuments,
  documentsCallback,
} from "../controllers/documents.controller.js";

const documentsRouter: ExpressRouter = Router();

documentsRouter.post("/", createDocuments);
documentsRouter.get("/callback/:status", documentsCallback);

export default documentsRouter;
