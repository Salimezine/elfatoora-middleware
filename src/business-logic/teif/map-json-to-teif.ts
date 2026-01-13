import type { Document } from "../../schemas/document.schema.js";
import {
  calculateGrandTotal,
  calculateSubtotal,
  calculateTaxTotal,
} from "../document/calculations.js";
import type { TeifInvoiceXml } from "./teif-types.js";

const formatAmount = (value: number) => value.toFixed(3); // TEIF usually expects fixed decimals

const formatDate = (date: Date | string) =>
  new Date(date).toISOString().slice(0, 10);

export function mapInvoiceToTeifXml(input: Document): TeifInvoiceXml {
  const subtotal = calculateSubtotal(input.lines);
  const taxTotal = calculateTaxTotal(input.lines);
  const grandTotal = calculateGrandTotal(subtotal, taxTotal);

  return {
    Invoice: {
      Header: {
        InvoiceNumber: input.header.documentNumber,
        IssueDate: formatDate(input.header.issueDate),
        InvoiceType: input.header.type, // must already match TEIF enum
        Currency: input.totals.totalTTC.currency,
      },

      Seller: {
        Name: input.seller.name,
        TaxId: input.seller.identifier,
        Address: {
          Street: input.seller.address?.street || "",
          City: input.seller.address?.city || "",
          Country: input.seller.address?.country || "",
        },
      },

      Buyer: {
        Name: input.buyer.name,
        TaxId: input.buyer.identifier,
        Address: {
          Street: input.buyer.address?.street || "",
          City: input.buyer.address?.city || "",
          Country: input.buyer.address?.country || "",
        },
      },

      Lines: {
        Line: input.lines.map((line, index) => ({
          LineNumber: index + 1,
          Description: line.description,
          Quantity: formatAmount(line.quantity),
          UnitPrice: formatAmount(line.unitPrice.amount),
          LineTotal: formatAmount(line.quantity * line.unitPrice.amount),
          TaxRate: formatAmount(line.taxRate),
        })),
      },

      Totals: {
        Subtotal: formatAmount(subtotal),
        TaxTotal: formatAmount(taxTotal),
        GrandTotal: formatAmount(grandTotal),
      },
    },
  };
}
