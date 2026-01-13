import { XMLBuilder } from "fast-xml-parser";
import type { TeifInvoiceXml } from "./teif-types.js";

const builder = new XMLBuilder({
  ignoreAttributes: false,
  format: false,
  suppressEmptyNode: true,
});

export function buildTeifXml(input: TeifInvoiceXml): string {
  return builder.build(input);
}
