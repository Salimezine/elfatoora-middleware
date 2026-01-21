import type { SftpCredentials } from "./sftp/sftp-client.js";
import {
  downloadFromTTNSftp,
  listTTNSftpFiles,
  uploadToTTNSftp,
} from "./sftp/upload-to-ttn.js";
import { consultDocumentWS, type TTNConsultResult } from "./ws/consult-doc.js";
import { submitToTTN, type TTNCredentials } from "./ws/submit-to-ttn.js";

type Options =
  | {
      mode: "WS";
      credentials: TTNCredentials;
    }
  | {
      mode: "SFTP";
      credentials: SftpCredentials;
      documentNumber: string;
      sellerTaxId: string;
    };

export interface TTNSubmitResult {
  success: boolean;
  rawResponse: string;
  error?: string;
}

export async function submitDocToTTN(
  signedTeifXml: string | Buffer,
  options: Options,
): Promise<TTNSubmitResult> {
  if (options.mode === "WS") {
    return submitToTTN(signedTeifXml, options.credentials);
  } else if (options.mode === "SFTP") {
    const response = await uploadToTTNSftp(
      signedTeifXml,
      options.credentials,
      options.documentNumber,
      options.sellerTaxId,
    );
    return {
      rawResponse: JSON.stringify(response),
      success: response.success,
      error: response.success ? undefined : response.error,
    };
  }
  // @ts-expect-error TS2345 - This should be unreachable
  throw new Error(`Unsupported submission mode: ${options.mode}`);
}

type GetDocFromTTNOptions =
  | {
      mode: "WS";
      credentials: TTNCredentials;
    }
  | {
      mode: "SFTP";
      credentials: SftpCredentials;
      documentNumber: string;
    };
export async function getDocFromTTN(
  documentNumber: string,
  sellerTaxId: string,
  options: GetDocFromTTNOptions,
): Promise<TTNConsultResult> {
  if (options.mode === "WS") {
    return consultDocumentWS(documentNumber, sellerTaxId, options.credentials);
  } else if (options.mode === "SFTP") {
    // List files in the SFTP inbox
    const listing = await listTTNSftpFiles(options.credentials, sellerTaxId);
    if (!listing.success) {
      return {
        rawResponse: JSON.stringify(listing),
        success: false,
        error: listing.error || "Failed to list SFTP files",
      };
    }

    // Check if the specific document exists
    const targetFile = listing.files.find((file) =>
      file.name.includes(documentNumber),
    );
    if (!targetFile) {
      return {
        rawResponse: JSON.stringify(listing),
        success: false,
        error: `Document ${documentNumber} not found in SFTP inbox`,
      };
    }

    // Download the specific document
    const file = await downloadFromTTNSftp(
      options.credentials,
      targetFile.name,
      sellerTaxId,
    );

    if (!file || !file.success) {
      return {
        success: false,
        rawResponse: "",
        error: `Failed to download document ${documentNumber} from SFTP`,
      };
    }

    // Valid document : numeroFacture.xml / invalid document : numeroFacture.error
    const fileExtension = targetFile.name.split(".").pop()?.toLowerCase();
    if (!fileExtension) {
      return {
        success: false,
        rawResponse: "",
        error: `Unknown file extension for document ${documentNumber}`,
      };
    }

    if (fileExtension === "error") {
      return {
        success: false,
        // TODO understand and parse error file content
        rawResponse: file.buffer.toString("utf-8"),
        error: `TTN reported an error for document ${documentNumber}`,
      };
    }

    return {
      success: true,
      rawResponse: file.buffer.toString("utf-8"),
      item: {
        xmlContent: file.buffer.toString("utf-8"),
      },
    };
  }
  // @ts-expect-error TS2345 - This should be unreachable
  throw new Error(`Unsupported submission mode: ${options.mode}`);
}
