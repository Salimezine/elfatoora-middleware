import type { Generated } from "kysely";
import type { suffix } from "./client.js";

/**
 * ---------------------------------------------------------------------
 * Enums (TypeScript mirrors of PostgreSQL enums)
 * ---------------------------------------------------------------------
 */

export type DocumentStatus =
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

export type DocumentType = "INVOICE" | "CREDIT_NOTE" | "DEBIT_NOTE";

export type DocumentEventType =
  | "RECEIVED"
  | "SIGNING_REQUESTED"
  | "SIGNED"
  | "SIGNING_FAILED"
  | "TTN_SUBMISSION_REQUESTED"
  | "TTN_SUBMITTED"
  | "TTN_ACCEPTED"
  | "TTN_REJECTED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "RETRIED"
  | "STATUS_CHANGED";

export type SubmissionStatus = "SENT" | "ACCEPTED" | "REJECTED" | "TIMEOUT";

/**
 * ---------------------------------------------------------------------
 * Tables
 * ---------------------------------------------------------------------
 */

export interface DocumentsTable {
  id: Generated<string>;

  external_document_id: string;
  source_system: string;

  document_number: string;
  document_type: DocumentType;
  issue_date: Date;

  seller_tax_id: string;
  buyer_tax_id: string | null;

  currency: string; // CHAR(3)
  total_ht: string; // numeric → string
  total_tva: string; // numeric → string
  total_ttc: string; // numeric → string

  status: DocumentStatus;

  created_at: Date;
  updated_at: Date;
}

export interface DocumentPayloadsTable {
  document_id: string;

  payload: unknown;
  payload_hash: string;
  schema_version: string | null;

  created_at: Date;
}

export interface DocumentArtifactsTable {
  document_id: string;

  teif_xml: string;
  xml_hash: string;

  signer: string;
  certificate_sn: string;
  certificate_issuer: string;
  signature_hash: string;

  signed_at: Date;
  generated_at: Date;
}

export interface InvoiceSubmissionsTable {
  id: Generated<string>;

  document_id: string;

  authority: string;
  request_payload: unknown | null;
  response_payload: unknown | null;

  authority_uuid: string | null;
  status: SubmissionStatus;

  error_code: string | null;
  error_message: string | null;

  attempt: number;
  submitted_at: Date;
}

export interface DocumentEventsTable {
  id: Generated<string>;

  document_id: string;

  event_type: DocumentEventType;
  from_status: DocumentStatus | null;
  to_status: DocumentStatus | null;

  metadata: unknown | null;
  created_at: Date;
}

/**
 * ---------------------------------------------------------------------
 * Database mapping (suffix-aware)
 * ---------------------------------------------------------------------
 */

type Tables<P extends string> = {
  [K in `${P}documents`]: DocumentsTable;
} & {
  [K in `${P}document_payloads`]: DocumentPayloadsTable;
} & {
  [K in `${P}document_artifacts`]: DocumentArtifactsTable;
} & {
  [K in `${P}invoice_submissions`]: InvoiceSubmissionsTable;
} & {
  [K in `${P}document_events`]: DocumentEventsTable;
};

export type DB = Tables<typeof suffix>;
