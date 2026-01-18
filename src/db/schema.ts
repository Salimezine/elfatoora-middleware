import type { Generated } from "kysely";
import type { suffix } from "./client.js";

export type DateOnly = `${number}-${number}-${number}`;

// Enums (TypeScript mirrors of PostgreSQL enums)

export type DocumentStatus =
  | "RECEIVED"
  | "SIGNING_PENDING"
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

// Tables

/**
 * Operations Table, each operation can contain multiple documents
 */
export interface Operation {
  /** Primary key, UUID */
  id: string;
  /** NGSign UUID, unique */
  ngsign_uuid: string | null;
  customer_id: string;
  success_callback_url: string;
  failure_callback_url: string;
  status: "PENDING" | "COMPLETED" | "FAILED";
  created_at: Date;
  updated_at: Date;
}

export interface Document {
  /** Primary key, UUID */
  id: string;
  /** Operation UUID, an operation can contain multiple documents */
  operation_id: string;
  source_system: string;

  document_number: string;
  document_type: DocumentType;
  issue_date: DateOnly;

  seller_tax_id: string;
  buyer_tax_id: string | null;

  currency: string; // CHAR(3)
  total_ht: number;
  total_tva: number;
  total_ttc: number;

  status: DocumentStatus;

  /** Big text containing the original json payload */
  payload: unknown;
  payload_hash: string;
  /** This API version of the schema used to validate the payload */
  schema_version: string | null;

  created_at: Date;
  updated_at: Date;
}

export interface DocumentArtifact {
  /** Primary key, UUID, document.id */
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

export interface DocumentEvent {
  /** Primary key, UUID */
  id: string;

  document_id: string;

  event_type: DocumentEventType;
  from_status: DocumentStatus | null;
  to_status: DocumentStatus | null;

  metadata: unknown | null;
  created_at: Date;
}

export interface TkrCustomers {
  id: Generated<string>;
  name: string;
  tax_id: string;
  mode: "TEST" | "PROD";
  ngsign_token: string;
  ngsign_signer_email: string;
  default_success_url: string | null;
  default_failure_url: string | null;
  ttn_login: string | null;
  ttn_password: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TkrCustomersTokens {
  id: Generated<string>;
  customer_id: string;
  token: string;
  name: string;
  is_active: boolean;
  expiration_date: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * ---------------------------------------------------------------------
 * Database mapping (suffix-aware)
 * ---------------------------------------------------------------------
 */

export type Tables<P extends string> = {
  [K in `${P}operations`]: Operation;
} & {
  [K in `${P}documents`]: Document;
} & {
  [K in `${P}documents_artifacts`]: DocumentArtifact;
} & {
  [K in `${P}documents_events`]: DocumentEvent;
} & {
  [K in `${P}tkr_customers`]: TkrCustomers;
} & {
  [K in `${P}tkr_customer_tokens`]: TkrCustomersTokens;
};

export type DB = Tables<typeof suffix>;
