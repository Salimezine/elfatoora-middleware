import { ngSignBase, ngsignFetch, toBase64 } from "./helpers.js";

// Input types

export type CreateSignatureTransactionInput = {
  invoices: {
    teifXmlContent: string;
    /** In base64 */
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
  invoiceFileB64: string;
  invoiceTIEF: string;
  clientEmail?: string;
  callbackUrl: { successUrl: string; failureUrl: string };
  invoiceNumber: string;
};

// Response types

export type CreateTransactionApiResponse = {
  object: {
    uuid: string;
    invoices: SignedInvoice[];
    creationDate: string; // ISO date
    status: string;
    digestAlgo: string;
    signingTime: string; // ISO date
    creator: Person;
    user: Person;
    organization: Organization;
    deleterId: Person;
    deleteDate: string; // ISO date
    deleted: boolean;
    locked: boolean;
    bySeal: boolean;
    bySealV2: boolean;
    wsOnlyCreation: boolean;
  };
  message: string;
  errorCode: number;
};

export type SignedInvoice = {
  status: string;
  uuid: string;
  clientEmail: string;
  ttnReference: string;
  ttnErrorMessage: string;
  invoiceNumber: string;
  invoiceDate: string; // ISO date
  withPDF: boolean;
  twoDocImage: string;
  callbackUrl: { successUrl: string; failureUrl: string };
  fileSize: number;
};

type Person = {
  email: string;
  firstName: string;
  lastName: string;
  additionalProp1: Record<string, unknown>;
};

type Organization = {
  name: string;
  id: string;
  additionalProp1: Record<string, unknown>;
};

export async function createSignatureTransaction(
  input: CreateSignatureTransactionInput,
  ngSignToken: string,
  mode: "PROD" | "TEST" = "TEST"
) {
  const payload: CreateTransactionPayload = {
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

  const response = await ngsignFetch<CreateTransactionApiResponse>(
    "/protected/invoice/xml/transaction/create",
    ngSignToken,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    mode
  );

  if (!response.object) {
    throw new Error(
      `NGSign create transaction failed: ${response.message} (code: ${response.errorCode})`
    );
  }

  return {
    url: ngSignBase(`/pds/#/teif/invoice/${response.object.uuid}`),
    uuid: response.object.uuid,
  };
}
