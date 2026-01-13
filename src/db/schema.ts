import type { Generated } from "kysely";
import type { suffix } from "./client.js";

/**
 * ---------------------------------------------------------------------
 * Tables
 * ---------------------------------------------------------------------
 */

export interface InvoicesTable {
  id: Generated<string>;
  number: string;
  status:
    | "RECEIVED"
    | "SIGNING_PENDING"
    | "SIGNED"
    | "SIGNING_FAILED"
    | "TTN_PENDING"
    | "TTN_SUBMITTED"
    | "TTN_ACCEPTED"
    | "TTN_REJECTED"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED";
  client_id: string;
  issued_at: Date | null;
  subtotal_ht: string; // numeric → string in Kysely
  total_tax: string; // numeric → string in Kysely
  total_ttc: string; // numeric → string in Kysely
  rules_version: string;
  snapshot_json: unknown;
  created_at: Date;
}

export interface InvoiceLinesTable {
  id: Generated<string>;
  invoice_id: string;
  quantity: string; // numeric
  unit_price: string; // numeric
  discount_rate: string | null;
}

export interface InvoiceAllowancesTable {
  id: Generated<string>;
  invoice_id: string;
  type: "DISCOUNT" | "SURCHARGE" | "WITHHOLDING";
  amount: string; // numeric
}

export interface InvoiceEventsTable {
  id: Generated<string>;
  invoice_id: string;
  type: string;
  payload: unknown;
  created_at: Date;
}

/**
 * ---------------------------------------------------------------------
 * Database mapping
 * ---------------------------------------------------------------------
 */

type Tables<P extends string> = {
  [K in `${P}invoices`]: InvoicesTable;
} & {
  [K in `${P}invoice_lines`]: InvoiceLinesTable;
} & {
  [K in `${P}invoice_allowances`]: InvoiceAllowancesTable;
} & {
  [K in `${P}invoice_events`]: InvoiceEventsTable;
};

export type DB = Tables<typeof suffix>;
