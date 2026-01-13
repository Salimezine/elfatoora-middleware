import type { NextFunction, Request, Response } from "express";
import { Router, type Router as ExpressRouter } from "express";

export const webhooksRouter: ExpressRouter = Router();

webhooksRouter.post(
  "/ttn",
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const xmlBuffer = req.body as Buffer;

      if (!Buffer.isBuffer(xmlBuffer)) {
        return res.status(400).json({
          error: "INVALID_PAYLOAD",
          message: "Expected raw XML body",
        });
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);
