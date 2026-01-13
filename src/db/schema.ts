import type { Generated } from "kysely";

export interface InvoicesTable {
  id: Generated<string>;
  number: string;
  status: "DRAFT" | "ISSUED" | "PAID";
  client_id: string;
  issued_at: Date | null;
  subtotal_ht: number;
  total_tax: number;
  total_ttc: number;
  rules_version: string;
  snapshot_json: unknown;
  created_at: Date;
}

export interface InvoiceLinesTable {
  id: Generated<string>;
  invoice_id: string;
  quantity: number;
  unit_price: number;
  discount_rate: number | null;
}

export interface DB {
  invoices: InvoicesTable;
  invoice_lines: InvoiceLinesTable;
}
