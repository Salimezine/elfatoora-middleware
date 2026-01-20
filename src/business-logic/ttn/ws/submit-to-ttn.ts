import { Buffer } from "node:buffer";

export interface TTNCredentials {
  login: string;
  password: string;
  taxId: string;
}

export interface TTNSubmitResult {
  success: boolean;
  rawResponse: string;
  error?: string;
}

const DEFAULT_TTN_ENDPOINT =
  "http://elfatoura.tradenet.com.tn:80/ElfatouraServices/EfactService";

/**
 * Submit a signed TEIF XML invoice to TTN (El Fatoora)
 *
 * @param signedTeifXml - Signed TEIF XML as string or Buffer
 * @param credentials  - TTN credentials
 */
export async function submitToTTN(
  signedTeifXml: string | Buffer,
  credentials: TTNCredentials,
): Promise<TTNSubmitResult> {
  const xmlBuffer =
    typeof signedTeifXml === "string"
      ? Buffer.from(signedTeifXml, "utf8")
      : signedTeifXml;

  const response = await fetch(DEFAULT_TTN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "",
    },
    body: buildSaveEfactEnvelope({
      ...credentials,
      documentBase64: xmlBuffer.toString("base64"),
    }),
  });

  const rawResponse = await response.text();

  if (!response.ok) {
    return {
      success: false,
      rawResponse,
      error: `HTTP ${response.status}`,
    };
  }

  if (containsSoapFault(rawResponse)) {
    return {
      success: false,
      rawResponse,
      error: extractSoapFault(rawResponse),
    };
  }

  return {
    success: true,
    rawResponse,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  SOAP XML                                  */
/* -------------------------------------------------------------------------- */

function buildSaveEfactEnvelope(input: {
  login: string;
  password: string;
  taxId: string;
  documentBase64: string;
}): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ser="http://services.elfatoura.tradenet.com.tn/">
  <soapenv:Header/>
  <soapenv:Body>
    <ser:saveEfact>
      <login>${escapeXml(input.login)}</login>
      <password>${escapeXml(input.password)}</password>
      <matricule>${escapeXml(input.taxId)}</matricule>
      <documentEfact>${input.documentBase64}</documentEfact>
    </ser:saveEfact>
  </soapenv:Body>
</soapenv:Envelope>`;
}

/* -------------------------------------------------------------------------- */
/*                               SOAP Helpers                                 */
/* -------------------------------------------------------------------------- */

function containsSoapFault(xml: string): boolean {
  return xml.includes("<faultcode>") || xml.includes("<soap:Fault>");
}

function extractSoapFault(xml: string): string {
  const match =
    xml.match(/<faultstring>(.*?)<\/faultstring>/) ||
    xml.match(/<soap:Fault>[\s\S]*?<\/soap:Fault>/);

  return match?.[1] ?? "Unknown SOAP fault";
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
