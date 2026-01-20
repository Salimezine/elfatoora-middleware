import { XMLParser } from "fast-xml-parser";
import { Buffer } from "node:buffer";

interface TTNAcknowledgment {
  code?: string;
  message?: string;
}

export interface ParsedEfact {
  documentNumber?: string;
  idSaveEfact?: number;
  documentType?: string;
  dateProcess?: string;
  dateDocument?: string;
  amountTax?: number;
  amount?: number;
  generatedRef?: string;
  xmlContent?: string;
  acknowledgments?: TTNAcknowledgment[];
}

interface ConsultEfactParsedResult {
  success: boolean;
  items: ParsedEfact[];
  error?: string;
}

interface RefTtnVal {
  referenceTTN: string;
  date: string;
  qrCodeBase64: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

export function parseConsultEfactResponse(
  soapXml: string,
): ConsultEfactParsedResult {
  let parsed: any;

  try {
    parsed = parser.parse(soapXml);
  } catch {
    return {
      success: false,
      items: [],
      error: "Invalid XML response",
    };
  }

  // Check if parsed object has the expected Envelope structure
  if (!parsed?.Envelope) {
    return {
      success: false,
      items: [],
      error: "Invalid XML response",
    };
  }

  const fault = parsed?.Envelope?.Body?.Fault || parsed?.Envelope?.Fault;

  if (fault) {
    return {
      success: false,
      items: [],
      error: fault.faultstring || fault.reason?.Text || "SOAP Fault",
    };
  }

  const body =
    parsed?.Envelope?.Body?.consultEfactResponse || parsed?.Envelope?.Body;

  // Try to extract items from the response - the API returns items/item structure
  let items = body?.items?.item || body?.return?.items?.item || [];

  // Fallback to the old efactCriteria structure for backward compatibility
  if (!items || (Array.isArray(items) && items.length === 0)) {
    const criteria = body?.return?.efactCriteria || body?.efactCriteria || [];
    items = toArray(criteria);
  }

  const list = toArray(items).map(parseCriteria);

  return {
    success: true,
    items: list,
  };
}

const teifParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  trimValues: true,
  parseTagValue: false,
});

export function extractRefTtnVal(xmlContent?: string): RefTtnVal | undefined {
  if (!xmlContent) return undefined;

  let parsed: any;

  try {
    parsed = teifParser.parse(xmlContent);
  } catch {
    return undefined;
  }

  const ref = parsed?.Invoice?.RefTtnVal || parsed?.RefTtnVal;

  if (!ref) return undefined;

  const referenceTTN = ref?.ReferenceTTN?.["#text"] || ref?.ReferenceTTN?.text,
    date = ttnDateToYmd(
      ref?.ReferenceDate?.DateText?.["#text"] ||
        ref?.ReferenceDate?.DateText?.text,
    ),
    qrCodeBase64 = ref?.ReferenceCEV;

  if (!referenceTTN || !date || !qrCodeBase64) {
    console.error("Incomplete RefTtnVal data", {
      referenceTTN,
      date,
      qrCodeBase64,
    });
    throw new Error("Incomplete RefTtnVal data");
  }

  return { referenceTTN, date, qrCodeBase64 };
}

/* -------------------------------------------------------------------------- */
/*                               Mappers                                       */
/* -------------------------------------------------------------------------- */

/**
 * Converts TTN DateText (ddMMyyHHmm) to yyyy-mm-dd
 * Example: 1609201239 → 2020-09-16
 */
function ttnDateToYmd(value?: string): string | undefined {
  if (!value || value.length !== 10) return undefined;

  const dd = value.slice(0, 2);
  const mm = value.slice(2, 4);
  const yy = value.slice(4, 6);

  // TTN years are 20xx in practice
  const yyyy = Number(yy) >= 70 ? `19${yy}` : `20${yy}`;

  return `${yyyy}-${mm}-${dd}`;
}

function parseCriteria(c: any): ParsedEfact {
  return {
    documentNumber: c.documentNumber,
    idSaveEfact: toNumber(c.idSaveEfact),
    documentType: c.documentType,
    dateProcess: c.dateProcess,
    dateDocument: c.dateDocument,
    amountTax: toNumber(c.amountTax),
    amount: toNumber(c.amount),
    generatedRef: c.generatedRef,
    xmlContent: decodeBase64(c.xmlContent),
    acknowledgments: parseAcknowledgments(c.listAcknowlegments),
  };
}

function parseAcknowledgments(input: any): TTNAcknowledgment[] | undefined {
  if (!input) return undefined;

  // Handle both direct array and nested acknowledgment structure
  const acknowledgments = input.acknowledgment
    ? toArray(input.acknowledgment)
    : toArray(input);

  return acknowledgments.map((ack) => ({
    code: ack.code,
    message: ack.message,
  }));
}

/* -------------------------------------------------------------------------- */
/*                               Helpers                                       */
/* -------------------------------------------------------------------------- */

function toArray<T>(value: T | T[]): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function toNumber(value: any): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function decodeBase64(value?: string): string | undefined {
  if (!value) return undefined;
  try {
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return undefined;
  }
}
