import { ngsignFetch } from "./helpers.js";

export async function downloadSignedXml(transactionUuid: string) {
  const response = await ngsignFetch<{
    object: string; // base64
    message: string;
    errorCode?: number;
  }>(`/protected/invoice/xml/xml/${transactionUuid}`, {
    method: "GET",
  });

  return Buffer.from(response.object, "base64");
}
