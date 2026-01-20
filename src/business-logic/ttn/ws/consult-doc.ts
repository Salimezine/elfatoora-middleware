import {
  parseConsultEfactResponse,
  type ParsedEfact,
} from "./parse-consult-efact-response.js";

interface TTNCredentials {
  login: string;
  password: string;
  taxId: string;
}

interface EfactCriteria {
  documentNumber?: string;
  idSaveEfact?: number;
  documentType?: string;
  dateDebutProcess?: string; // YYYY-MM-DD
  dateFinProcess?: string; // YYYY-MM-DD
  dateDebutDocument?: string;
  dateFinDocument?: string;
  amountTax?: number;
  amount?: number;
  generatedRef?: string;
}

type TTNConsultResult = {
  success: boolean;
  rawResponse: string;
} & (
  | {
      success: true;
      item: ParsedEfact;
    }
  | {
      success: false;
      error: string;
    }
);

const DEFAULT_TTN_ENDPOINT =
  "http://elfatoura.tradenet.com.tn:80/ElfatouraServices/EfactService";

/**
 * Consult invoice(s) status from TTN
 */
export async function consultDocument(
  documentNumber: string,
  credentials: TTNCredentials,
): Promise<TTNConsultResult> {
  const soapEnvelope = buildConsultDocumentEnvelope(credentials, {
    documentNumber,
  });

  const response = await fetch(DEFAULT_TTN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: "",
    },
    body: soapEnvelope,
  });

  const rawResponse = await response.text();

  if (!response.ok) {
    return {
      success: false,
      rawResponse,
      error: `HTTP ${response.status}`,
    };
  }

  const parsed = parseConsultEfactResponse(rawResponse);

  if (!parsed.success) {
    return {
      success: false,
      rawResponse,
      error: parsed.error || "Unknown error",
    };
  }

  if (parsed.items.length === 0) {
    return {
      success: false,
      rawResponse,
      error: "No items found in TTN response",
    };
  }

  return {
    success: true,
    rawResponse,
    item: parsed.items[0]!,
  };
}

/* -------------------------------------------------------------------------- */
/*                                  SOAP XML                                  */
/* -------------------------------------------------------------------------- */

function buildConsultDocumentEnvelope(
  input: TTNCredentials,
  criteria: EfactCriteria,
): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
  xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ser="http://services.elfatoura.tradenet.com.tn/">
  <soapenv:Header/>
  <soapenv:Body>
    <ser:consultEfact>
      <login>${escapeXml(input.login)}</login>
      <password>${escapeXml(input.password)}</password>
      <matricule>${escapeXml(input.taxId)}</matricule>
      <efactCriteria>
        ${criteriaToXml(criteria)}
      </efactCriteria>
    </ser:consultEfact>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function criteriaToXml(criteria: EfactCriteria): string {
  const entries: [keyof EfactCriteria, unknown][] = Object.entries(
    criteria,
  ) as any;

  return entries
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => {
      return `<${key}>${escapeXml(String(value))}</${key}>`;
    })
    .join("");
}

/* -------------------------------------------------------------------------- */
/*                               SOAP Helpers                                  */
/* -------------------------------------------------------------------------- */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
