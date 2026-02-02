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
      taxRate: 14,
    },
    {
      lineNumber: 2,
      description: "Service B",
      quantity: 1,
      unitPrice: { amount: 50, currency: "EGP" },
      taxRate: 14,
    },
  ],
  totals: {
    subtotalHT: { amount: 260, currency: "EGP" },
    totalTax: { amount: 36.4, currency: "EGP" },
    totalTTC: { amount: 296.4, currency: "EGP" },
  },
};

test("mapInvoiceToTeifXml - basic mapping", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  assert.equal(result.TEIF.InvoiceBody.Bgm.DocumentIdentifier, "INV-001");
  assert.equal(result.TEIF.InvoiceBody.Bgm.DocumentType["#text"], "Facture");
});

test("mapInvoiceToTeifXml - sender and receiver identifiers", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  assert.equal(
    result.TEIF.InvoiceHeader.MessageSenderIdentifier["#text"],
    "TAX123456",
  );
  assert.equal(
    result.TEIF.InvoiceHeader.MessageRecieverIdentifier["#text"],
    "TAX654321",
  );
});

test("mapInvoiceToTeifXml - date formatting to TEIF format", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  const dateTexts = result.TEIF.InvoiceBody.Dtm.DateText;
  assert.equal(dateTexts[0]["#text"], "150124");
  assert.equal(dateTexts[1]["#text"], "150124");
});

test("mapInvoiceToTeifXml - seller info", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  const seller = result.TEIF.InvoiceBody.PartnerSection.PartnerDetails[0];
  assert.equal(seller.Nad.PartnerIdentifier["#text"], "TAX123456");
  assert.equal(seller.Nad.PartnerName["#text"], "Seller Corp");
  assert.equal(seller.Nad.PartnerAdresses?.CityName, "Cairo");
});

test("mapInvoiceToTeifXml - buyer info", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  const buyer = result.TEIF.InvoiceBody.PartnerSection.PartnerDetails[1];
  assert.equal(buyer.Nad.PartnerIdentifier["#text"], "TAX654321");
  assert.equal(buyer.Nad.PartnerName["#text"], "Buyer Inc");
});

test("mapInvoiceToTeifXml - line items count", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  assert.equal(result.TEIF.InvoiceBody.LinSection.Lin.length, 2);
});

test("mapInvoiceToTeifXml - line details", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  const line = result.TEIF.InvoiceBody.LinSection.Lin[0];
  assert.equal(line.ItemIdentifier, "1");
  assert.equal(line.LinImd.ItemDescription, "Product A");
  assert.equal(line.LinQty?.Quantity, "2.000");
});

test("mapInvoiceToTeifXml - amount formatting to 3 decimals", () => {
  const result = mapInvoiceToTeifXml(mockDocument);
  const unitPrice =
    result.TEIF.InvoiceBody.LinSection.Lin[0].LinMoa?.UnitPriceMoa?.Amount;
  assert.match(unitPrice || "", /^\d+\.\d{3}$/);
});

test("mapInvoiceToTeifXml - missing address fields", () => {
  const docMissingAddress = { ...mockDocument };
  docMissingAddress.seller.address = undefined;
  const result = mapInvoiceToTeifXml(docMissingAddress);
  const seller = result.TEIF.InvoiceBody.PartnerSection.PartnerDetails[0];
  assert.equal(seller.Nad.PartnerAdresses?.StreetName, undefined);
  assert.equal(seller.Nad.PartnerAdresses?.CityName, undefined);
});
