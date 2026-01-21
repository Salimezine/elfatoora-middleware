import type { Router as ExpressRouter } from "express";
import { Router } from "express";
import {
  createDocuments,
  documentsCallback,
  getDocumentArtifacts,
  getDocumentStatus,
} from "../controllers/documents.controller.js";

const documentsRouter: ExpressRouter = Router();

documentsRouter.post("/", createDocuments);
documentsRouter.post("/callback/:status", documentsCallback);
documentsRouter.get("/status/:invoiceNumber", getDocumentStatus);
documentsRouter.get("/artifacts/:invoiceNumber", getDocumentArtifacts);

export default documentsRouter;
