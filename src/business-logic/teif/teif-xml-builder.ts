import { XMLBuilder } from "fast-xml-parser";
import type { TeifInvoiceXml } from "./teif-types.js";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: false,
  suppressEmptyNode: true,
  attributeNamePrefix: "@_",
});

export function buildTeifXml(input: TeifInvoiceXml): string {
  const xmlBody = builder.build(input);
  return `<?xml version="1.0" encoding="UTF-8"?>${xmlBody}`;
}
