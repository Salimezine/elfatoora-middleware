import type { NextFunction, Request, Response } from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { db, tbl } from "../db/client.js";
import {
  ClientTaxIdParamSchema,
  CreateClientSchema,
  UpdateClientSchema,
} from "../schemas/client.schema.js";
import { NotFoundError, TkrAppError } from "../utils/error.utils.js";

function modeToDb(mode: "test" | "prod" | undefined): "TEST" | "PROD" {
  return mode === "prod" ? "PROD" : "TEST";
}

function fallbackSignerEmail(taxId: string): string {
  const normalizedTaxId = taxId.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `pending+${normalizedTaxId}@example.com`;
}

function generateApiToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createClient(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const payload = CreateClientSchema.parse(req.body);

    const existingCustomer = await db
      .selectFrom(tbl("tkr_customers"))
      .select(["id"])
      .where("tax_id", "=", payload.taxId)
      .executeTakeFirst();

    if (existingCustomer) {
      throw new TkrAppError(
        409,
        `Client with taxId ${payload.taxId} already exists`,
        "CONFLICT",
      );
    }

    const customerId = randomUUID();
    const token = generateApiToken();
    const now = new Date();

    await db.transaction().execute(async (trx) => {
      await trx
        .insertInto(tbl("tkr_customers"))
        .values({
          id: customerId,
          name: payload.name,
          tax_id: payload.taxId,
          mode: modeToDb(payload.mode),
          ngsign_token: payload.ngsign_token ?? "",
          ngsign_signer_email:
            payload.ngsign_signer_email ?? fallbackSignerEmail(payload.taxId),
          ttn_login: payload.ttn_login ?? null,
          ttn_password: payload.ttn_password ?? null,
          is_active: true,
          created_at: now,
          updated_at: now,
        })
        .execute();

      await trx
        .insertInto(tbl("tkr_customer_tokens"))
        .values({
          id: randomUUID(),
          customer_id: customerId,
          token,
          name: payload.api,
          is_active: true,
          created_at: now,
          updated_at: now,
        })
        .execute();
    });

    res.status(201).json({
      message: "Client created successfully",
      client: {
        id: customerId,
        name: payload.name,
        taxId: payload.taxId,
        mode: modeToDb(payload.mode).toLowerCase(),
      },
      token: {
        name: payload.api,
        value: token,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateClient(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { taxId } = ClientTaxIdParamSchema.parse(req.params);
    const payload = UpdateClientSchema.parse(req.body);

    const existingCustomer = await db
      .selectFrom(tbl("tkr_customers"))
      .select(["id"])
      .where("tax_id", "=", taxId)
      .executeTakeFirst();

    if (!existingCustomer) {
      throw new NotFoundError(`Client with taxId ${taxId} not found`);
    }

    const updates: {
      mode?: "TEST" | "PROD";
      ngsign_token?: string;
      ngsign_signer_email?: string;
      ttn_login?: string | null;
      ttn_password?: string | null;
      updated_at: Date;
    } = {
      updated_at: new Date(),
    };

    if (payload.mode) updates.mode = modeToDb(payload.mode);
    if (payload.ngsign_token !== undefined)
      updates.ngsign_token = payload.ngsign_token;
    if (payload.ngsign_signer_email !== undefined)
      updates.ngsign_signer_email = payload.ngsign_signer_email;
    if (payload.ttn_login !== undefined) updates.ttn_login = payload.ttn_login;
    if (payload.ttn_password !== undefined)
      updates.ttn_password = payload.ttn_password;

    const updated = await db
      .updateTable(tbl("tkr_customers"))
      .set(updates)
      .where("tax_id", "=", taxId)
      .returning([
        "id",
        "name",
        "tax_id as taxId",
        "mode",
        "ngsign_token",
        "ngsign_signer_email",
        "ttn_login",
      ])
      .executeTakeFirstOrThrow();

    res.status(200).json({
      message: "Client updated successfully",
      client: {
        ...updated,
        mode: updated.mode.toLowerCase(),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function removeClient(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { taxId } = ClientTaxIdParamSchema.parse(req.params);

    const deleted = await db
      .deleteFrom(tbl("tkr_customers"))
      .where("tax_id", "=", taxId)
      .returning(["id", "name", "tax_id as taxId"])
      .executeTakeFirst();

    if (!deleted) {
      throw new NotFoundError(`Client with taxId ${taxId} not found`);
    }

    res.status(200).json({
      message: "Client removed successfully",
      client: deleted,
    });
  } catch (error) {
    next(error);
  }
}
