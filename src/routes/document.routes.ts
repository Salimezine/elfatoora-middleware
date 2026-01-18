import type { Router as ExpressRouter } from "express";
import { Router } from "express";
import {
  createDocuments,
  documentsCallback,
  getDocumentStatus,
} from "../controllers/documents.controller.js";

const documentsRouter: ExpressRouter = Router();

documentsRouter.post("/", createDocuments);
documentsRouter.post("/callback/:status", documentsCallback);
documentsRouter.get("/status/:invoiceNumber", getDocumentStatus);

export default documentsRouter;
