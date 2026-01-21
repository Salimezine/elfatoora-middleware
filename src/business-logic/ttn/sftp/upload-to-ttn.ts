import type { FileInfo } from "ssh2-sftp-client";
import { SftpManager, type SftpCredentials } from "./sftp-client.js";

export interface SftpUploadResult {
  success: boolean;
  remoteFilePath?: string;
  fileName?: string;
  error?: string;
}

const SLASH_REPLACEMENT = "__SLASH__";

/**
 * Upload signed TEIF XML invoice to TTN via SFTP
 *
 * @param signedTeifXml - Signed TEIF XML as string or Buffer
 * @param credentials - SFTP credentials
 * @param fileName - Name of the file to upload
 */
export async function uploadToTTNSftp(
  signedTeifXml: string | Buffer,
  credentials: SftpCredentials,
  sellerTaxId: string,
  documentNumber: string,
): Promise<SftpUploadResult> {
  const buffer =
    typeof signedTeifXml === "string"
      ? Buffer.from(signedTeifXml, "utf8")
      : signedTeifXml;

  // Replace / with a unique string that won't be confused with regular underscores
  const fileName = `${documentNumber.replace(/\//g, SLASH_REPLACEMENT)}.xml`;

  const remoteFilePath = `/${sellerTaxId}/${credentials.username}/in/${fileName}.xml`;

  const sftp = new SftpManager(credentials);

  try {
    await sftp.connect();
    await sftp.uploadBuffer(buffer, remoteFilePath);
    await sftp.disconnect();

    return {
      success: true,
      remoteFilePath,
      fileName: fileName,
    };
  } catch (error) {
    await sftp.autoClose();

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Download file from TTN SFTP inbox
 *
 * @param credentials - SFTP credentials
 * @param fileName - Name of the file to download
 */
export async function downloadFromTTNSftp(
  credentials: SftpCredentials,
  fileName: string,
  sellerTaxId: string,
) {
  const sftp = new SftpManager(credentials);

  try {
    await sftp.connect();
    const remoteFilePath = `/${sellerTaxId}/${credentials.username}/out/${fileName}`;
    const buffer = await sftp.downloadBuffer(remoteFilePath);
    await sftp.disconnect();

    // Restore original file name by replacing the unique string back to /
    const originalFileName = `${fileName.replace(new RegExp(SLASH_REPLACEMENT, "g"), "/")}`;

    return { success: true, buffer, originalFileName, error: null } as const;
  } catch (error) {
    await sftp.autoClose();
    return {
      success: false,
      buffer: null,
      originalFileName: null,
      error: error instanceof Error ? error.message : String(error),
    } as const;
  }
}

type ListTTNSftpFilesResult =
  | { success: true; files: FileInfo[]; error: null }
  | { success: false; files: null; error: string };

/**
 * List files in TTN SFTP directory
 *
 * @param credentials - SFTP credentials
 * @param directoryPath - Directory path (defaults to inbox)
 */
export async function listTTNSftpFiles(
  credentials: SftpCredentials,
  sellerTaxId: string,
): Promise<ListTTNSftpFilesResult> {
  const remotePath = `/${sellerTaxId}/${credentials.username}/out/`;

  const sftp = new SftpManager(credentials);

  try {
    await sftp.connect();
    const files = await sftp.listFiles(remotePath);
    await sftp.disconnect();

    return {
      success: true,
      files,
      error: null,
    };
  } catch (error) {
    await sftp.autoClose();

    return {
      success: false,
      files: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

type DeleteTTNSftpFileResult =
  | { success: true; error: null }
  | { success: false; error: string };

/**
 * Delete file from TTN SFTP
 *
 * @param credentials - SFTP credentials
 * @param fileName - Name of the file to delete
 */
export async function deleteTTNSftpFile(
  credentials: SftpCredentials,
  remoteFilePath: string,
): Promise<DeleteTTNSftpFileResult> {
  const sftp = new SftpManager(credentials);

  try {
    await sftp.connect();
    await sftp.deleteFile(remoteFilePath);
    await sftp.disconnect();

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    await sftp.autoClose();

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
