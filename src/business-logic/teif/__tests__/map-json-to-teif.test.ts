import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Document } from "../../../schemas/document.schema.js";
import { mapInvoiceToTeifXml } from "../map-json-to-teif.js";

const mockDocument: Document = {
  header: {
    documentNumber: "INV-001",
    issueDate: "2024-01-15",
    type: "INVOICE",
  },
  seller: {
    name: "Seller Corp",
    identifier: "TAX123456",
    identifierType: "FISCAL_ID",
    address: {
      street: "123 Main St",
      city: "Cairo",
      country: "EG",
    },
  },
  buyer: {
    name: "Buyer Inc",
    identifier: "TAX654321",
    identifierType: "FISCAL_ID",
    address: {
      street: "456 Oak Ave",
      city: "Giza",
      country: "EG",
    },
  },
  lines: [
    {
      lineNumber: 1,
      description: "Product A",
      quantity: 2,
      unitPrice: { amount: 100, currency: "EGP" },
      taxRate: 0.14,
    },
    {
      lineNumber: 2,
      description: "Service B",
      quantity: 1,
      unitPrice: { amount: 50, currency: "EGP" },
      taxRate: 0.14,
    },
  ],
  totals: {
    subtotalHT: { amount: 260, currency: "EGP" },
    totalTax: { amount: 37.1, currency: "EGP" },
    totalTTC: { amount: 297.1, currency: "EGP" },
  },
};

test("mapInvoiceToTeifXml - basic mapping", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  assert.equal(result.Invoice.Header.InvoiceNumber, "INV-001");
  assert.equal(result.Invoice.Header.InvoiceType, "INVOICE");
});

test("mapInvoiceToTeifXml - date formatting", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  assert.equal(result.Invoice.Header.IssueDate, "2024-01-15");
});

test("mapInvoiceToTeifXml - seller info", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  assert.equal(result.Invoice.Seller.Name, "Seller Corp");
  assert.equal(result.Invoice.Seller.TaxId, "TAX123456");
  assert.equal(result.Invoice.Seller.Address.City, "Cairo");
});

test("mapInvoiceToTeifXml - buyer info", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  assert.equal(result.Invoice.Buyer.Name, "Buyer Inc");
  assert.equal(result.Invoice.Buyer.TaxId, "TAX654321");
});

test("mapInvoiceToTeifXml - line items count", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  assert.equal(result.Invoice.Lines.Line.length, 2);
});

test("mapInvoiceToTeifXml - line numbering", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  assert.equal(result.Invoice.Lines.Line[0].LineNumber, 1);
  assert.equal(result.Invoice.Lines.Line[1].LineNumber, 2);
});

test("mapInvoiceToTeifXml - amount formatting to 3 decimals", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  assert.match(result.Invoice.Lines.Line[0].UnitPrice, /^\d+\.\d{3}$/);
});

test("mapInvoiceToTeifXml - missing address fields", () => {
  const docMissingAddress = { ...mockDocument };
  docMissingAddress.seller.address = undefined;
  const result = mapInvoiceToTeifXml(docMissingAddress);
  assert.equal(result.Invoice.Seller.Address.Street, "");
  assert.equal(result.Invoice.Seller.Address.City, "");
});
