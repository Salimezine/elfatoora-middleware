import { ngSignBase, ngsignFetch, toBase64 } from "./helpers.js";
import type {
  NGXMLCreationInvoiceUpload,
  ResponseNGXMLInvoiceTransaction,
} from "./ngsign-api.js";

// Input types

export type CreateSignatureTransactionInput = {
  invoices: {
    teifXmlContent: string;
    /**
     * Base64 encoded PDF string.
     * This PDF is intended solely for display purposes to the user on signage
     * and is not used for processing or verification.
     **/
    pdfContent: string;
    invoiceNumber: string;
    callbackUrl?: { successUrl?: string; failureUrl?: string };
  }[];
  callbackUrl: { successUrl: string; failureUrl: string };
  signerEmail: string;
};

export type CreateTransactionPayload = {
  invoices: Invoice[];
  signerEmail: string;
};

export type Invoice = {
  /**
   * Base64 encoded PDF string.
   * This PDF is intended solely for display purposes to the user on signage
   * and is not used for processing or verification.
   **/
  invoiceFileB64: string;
  invoiceTIEF: string;
  clientEmail?: string;
  callbackUrl: { successUrl: string; failureUrl: string };
  invoiceNumber: string;
};

export async function createSignatureTransaction(
  input: CreateSignatureTransactionInput,
  ngSignToken: string,
  mode: "PROD" | "TEST" = "TEST",
) {
  const payload: NGXMLCreationInvoiceUpload = {
    invoices: input.invoices.map((inv) => {
      const xmlBuffer = Buffer.from(inv.teifXmlContent, "base64");
      return {
        invoiceTIEF: toBase64(xmlBuffer),
        invoiceFileB64: inv.pdfContent,
        invoiceNumber: inv.invoiceNumber,
        callbackUrl: {
          successUrl:
            inv.callbackUrl?.successUrl ?? input.callbackUrl.successUrl,
          failureUrl:
            inv.callbackUrl?.failureUrl ?? input.callbackUrl.failureUrl,
        },
      };
    }),
    signerEmail: input.signerEmail,
  };

  const response = await ngsignFetch<ResponseNGXMLInvoiceTransaction>(
    "/protected/invoice/xml/transaction/create",
    ngSignToken,
    { method: "POST", body: JSON.stringify(payload) },
    mode,
  );

  if (!response.object?.uuid) {
    throw new Error(
      `NGSign create transaction failed: ${response.message} (code: ${response.errorCode})`,
    );
  }

  return {
    url: ngSignBase(`/pds/#/teif/invoice/${response.object.uuid}`),
    uuid: response.object.uuid,
  };
}
