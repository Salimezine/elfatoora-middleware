/* ============================
 * NGSign API – Type Declarations
 * OpenAPI 3.0.3
 * Version: 2.37
 * ============================
 */

/* ============
 * Enums
 * ============
 */

export enum InvoiceStatus {
  CREATED = "CREATED",
  SIGNED = "SIGNED",
  CANCELLED = "CANCELLED",
  TTN_NOT_TRANSFERED = "TTN_NOT_TRANSFERED",
  TTN_TRANSFERED = "TTN_TRANSFERED",
  TTN_REJECTED = "TTN_REJECTED",
  TTN_SIGNED = "TTN_SIGNED",
}

/* ============
 * Common / Utility Types
 * ============
 */

/** Base64-encoded binary content */
export type Base64String = string;

/** ISO 8601 date-time string */
export type ISODateTime = string;

/* ============
 * Security
 * ============
 */

export interface BearerAuth {
  /** JWT token */
  token: string;
}

/* ============
 * Core Domain Models
 * ============
 */

export interface NGUser {
  email?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: unknown;
}

export interface NGLimitedOrganization {
  name?: string;
  id?: string;
  [key: string]: unknown;
}

export interface NGCallbackUrl {
  successUrl?: string;
  failureUrl?: string;
}

export interface InvoiceConfiguration {
  qrPositionX?: number;
  qrPositionY?: number;
  qrPositionP?: number;

  labelPositionX?: number;
  labelPositionY?: number;
  labelPositionP?: number;

  qrRatio?: number; // default: 0.5

  textPositionX?: number;
  textPositionY?: number;
  textPage?: number;

  allPages?: boolean; // default: false
}

/* ============
 * Invoice Upload Models
 * ============
 */

export interface NGXMLInvoiceUpload {
  /** PDF file content (Base64) */
  invoiceFileB64?: Base64String;

  configuration?: InvoiceConfiguration;

  /** TEIF XML content (Base64) */
  invoiceTIEF?: Base64String;

  clientEmail?: string;

  callbackUrl?: NGCallbackUrl;

  invoiceNumber?: string;
}

export interface NGXMLCreationInvoiceUpload {
  /** List of invoices to upload */
  invoices?: NGXMLInvoiceUpload[];

  /**
   * Signer email.
   * If null/undefined, the creator is assumed to be the signer.
   */
  signerEmail?: string;
}

export interface NGXMLAdvancedInvoiceUpload {
  invoices?: NGXMLInvoiceUpload[];

  /** Must belong to the organization */
  signerEmail?: string;

  /** Optional seal passphrase */
  passphrase?: string;

  /** CC email (optional) */
  ccEmail?: string;
}

/* ============
 * Invoice & Transaction Models
 * ============
 */

export interface NGXMLInvoice {
  status?: InvoiceStatus;

  uuid?: string;

  clientEmail?: string;

  /** TTN-generated reference */
  ttnReference?: string;

  /** TTN error message if any */
  ttnErrorMessage?: string;

  invoiceNumber?: string;

  invoiceDate?: ISODateTime;

  /** Whether a PDF was provided */
  withPDF?: boolean;

  /** 2D-Doc image (Base64) */
  twoDocImage?: Base64String;

  callbackUrl?: NGCallbackUrl;

  /** File size in bytes */
  fileSize?: number;
}

export interface NGXMLInvoiceTransaction {
  /** Unique transaction identifier */
  uuid?: string;

  invoices?: NGXMLInvoice[];

  creationDate?: ISODateTime;

  status?: string;

  digestAlgo?: string;

  signingTime?: ISODateTime;

  creator?: NGUser;

  user?: NGUser;

  organization?: NGLimitedOrganization;

  deleterId?: NGUser;

  deleteDate?: ISODateTime;

  deleted?: boolean;

  locked?: boolean;

  /** Signed using electronic seal */
  bySeal?: boolean;

  /** Signed using seal V2 (without PDF) */
  bySealV2?: boolean;

  /** Created via Web Service only */
  wsOnlyCreation?: boolean;
}

/* ============
 * Webhook
 * ============
 */

export interface WebhookPayload {
  /** Invoice UUID */
  uuid?: string;

  invoiceNumber?: string;

  /** TTN reference (nullable) */
  ttnReference?: string | null;

  /** 2D-Doc image (Base64, nullable) */
  twoDocImage?: Base64String | null;

  /** Signed PDF (Base64, nullable) */
  pdfBase64?: Base64String | null;

  /** Signed XML (Base64) */
  xmlBase64?: Base64String;
}

/* ============
 * API Response Wrappers
 * ============
 */

export interface ApiResponseBase {
  message?: string;
  errorCode?: number;
}

export interface ResponseVoid extends ApiResponseBase {}

export interface ResponseByteArray extends ApiResponseBase {
  object?: Base64String;
}

export interface ResponseNGXMLInvoice extends ApiResponseBase {
  object?: NGXMLInvoice;
  ccEmail?: string;
}

export interface ResponseNGXMLInvoiceTransaction extends ApiResponseBase {
  object?: NGXMLInvoiceTransaction;
}

/* ============
 * API Endpoints (Request / Response typings)
 * ============
 */

/**
 * POST /protected/invoice/xml/transaction/create
 */
export interface CreateInvoiceTransactionRequest {
  body: NGXMLCreationInvoiceUpload;
}

export interface CreateInvoiceTransactionResponse extends ResponseNGXMLInvoiceTransaction {}

/**
 * POST /protected/invoice/xml/check/{uuid}
 */
export interface CheckInvoiceStatusRequest {
  uuid: string;
}

export interface CheckInvoiceStatusResponse extends ResponseNGXMLInvoice {}

/**
 * GET /protected/invoice/xml/xml/{uuid}
 */
export interface DownloadInvoiceXmlRequest {
  uuid: string;
}

export interface DownloadInvoiceXmlResponse extends ResponseByteArray {}
