/* =======================
   Enums
======================= */

export enum InvoiceStatus {
  CREATED = "CREATED",
  SIGNED = "SIGNED",
  CANCELLED = "CANCELLED",
  TTN_NOT_TRANSFERED = "TTN_NOT_TRANSFERED",
  TTN_TRANSFERED = "TTN_TRANSFERED",
  TTN_REJECTED = "TTN_REJECTED",
  TTN_SIGNED = "TTN_SIGNED",
}

/* =======================
   Common / Utility
======================= */

export interface ResponseVoid {
  message?: string;
  errorCode?: number;
}

export interface ResponseByteArray {
  object?: string; // base64
  message?: string;
  errorCode?: number;
}

/* =======================
   Users & Organization
======================= */

export interface NGUser {
  email?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: any;
}

export interface NGLimitedOrganization {
  id?: string;
  name?: string;
  [key: string]: any;
}

/* =======================
   Callback
======================= */

export interface NGCallbackUrl {
  successUrl?: string;
  failureUrl?: string;
}

/* =======================
   Invoice Configuration
======================= */

export interface InvoiceConfiguration {
  qrPositionX?: number;
  qrPositionY?: number;
  qrPositionP?: number;
  labelPositionX?: number;
  labelPositionY?: number;
  labelPositionP?: number;
  qrRatio?: number; // default 0.5
  textPositionX?: number;
  textPositionY?: number;
  textPage?: number;
  allPages?: boolean; // default false
}

/* =======================
   Invoice Upload
======================= */

export interface NGXMLInvoiceUpload {
  invoiceFileB64?: string;
  invoiceTIEF?: string;
  invoiceNumber?: string;
  clientEmail?: string;
  configuration?: InvoiceConfiguration;
  callbackUrl?: NGCallbackUrl;
}

export interface NGXMLCreationInvoiceUpload {
  invoices?: NGXMLInvoiceUpload[];
  signerEmail?: string | null;
}

export interface NGXMLAdvancedInvoiceUpload {
  invoices?: NGXMLInvoiceUpload[];
  signerEmail?: string;
  passphrase?: string;
  ccEmail?: string;
}

/* =======================
   Invoice Domain
======================= */

export interface NGXMLInvoice {
  uuid?: string;
  status?: InvoiceStatus;
  clientEmail?: string;
  invoiceNumber?: string;
  invoiceDate?: string; // ISO date-time
  ttnReference?: string;
  ttnErrorMessage?: string;
  withPDF?: boolean;
  twoDocImage?: string; // base64
  callbackUrl?: NGCallbackUrl;
  fileSize?: number;
}

export interface NGXMLInvoiceTransaction {
  uuid?: string;
  invoices?: NGXMLInvoice[];
  creationDate?: string; // ISO date-time
  status?: string;
  digestAlgo?: string;
  signingTime?: string; // ISO date-time
  creator?: NGUser;
  user?: NGUser;
  organization?: NGLimitedOrganization;
  deleterId?: NGUser;
  deleteDate?: string; // ISO date-time
  deleted?: boolean;
  locked?: boolean;
  bySeal?: boolean;
  bySealV2?: boolean;
  wsOnlyCreation?: boolean;
}

/* =======================
   API Responses
======================= */

export interface ResponseNGXMLInvoiceTransaction {
  object?: NGXMLInvoiceTransaction;
  message?: string;
  errorCode?: number;
}

export interface ResponseNGXMLInvoice {
  object?: NGXMLInvoice;
  message?: string;
  errorCode?: number;
  ccEmail?: string;
}

/* =======================
   Webhook
======================= */

export interface WebhookPayload {
  uuid?: string;
  invoiceNumber?: string;
  ttnReference?: string | null;
  twoDocImage?: string | null;
  pdfBase64?: string | null;
  xmlBase64?: string;
}
