import { db } from "../../db/client.js";
import type { TkrCustomers } from "../../db/schema.js";

export type TokenError = "MISSING" | "CUSTOMER_INACTIVE";

export async function verifyToken(token: string) {
  try {
    const customer = await db
      .selectFrom("tbl_tkr_customer_tokens")
      .leftJoin(
        "tbl_tkr_customers",
        "tbl_tkr_customer_tokens.customer_id",
        "tbl_tkr_customers.id"
      )
      .selectAll("tbl_tkr_customers")
      .where("token", "=", token)
      .where("tbl_tkr_customer_tokens.is_active", "=", true)
      .where((eb) =>
        eb.or([
          eb("tbl_tkr_customer_tokens.expiration_date", ">", new Date()),
          eb("tbl_tkr_customer_tokens.expiration_date", "is", null),
        ])
      )
      .selectAll()
      .executeTakeFirst();

    if (!customer) {
      return { error: "MISSING" as TokenError, customer: null };
    }

    // Check if customer active
    if (!customer.is_active) {
      return { error: "CUSTOMER_INACTIVE" as TokenError, customer: null };
    }

    return { customer: customer as unknown as TkrCustomers, error: null };
  } catch (error) {
    console.error("Error verifying token:", error);
    return { error: "MISSING" as TokenError, customer: null };
  }
}
