import { Router, type Router as ExpressRouter } from "express";
import {
  createClient,
  removeClient,
  updateClient,
} from "../controllers/clients.controller.js";

const clientsRouter: ExpressRouter = Router();

clientsRouter.post("/", createClient);
clientsRouter.patch("/:taxId", updateClient);
clientsRouter.delete("/:taxId", removeClient);

export default clientsRouter;
