import assert from "node:assert/strict";
import test from "node:test";
import { DocumentSchema } from "../document.schema.js";

test("fails when subtotal does not match lines", () => {
  const result = DocumentSchema.safeParse({
    header: {
      documentNumber: "INV-001",
      issueDate: "2025-01-10",
      type: "INVOICE",
    },
    seller: {
      identifierType: "FISCAL_ID",
      identifier: "1234567AAM000",
      name: "Seller SARL",
    },
    buyer: {
      identifierType: "CIN",
      identifier: "01234567",
      name: "Buyer",
    },
    lines: [
      {
        lineNumber: 1,
        description: "Item",
        quantity: 2,
        unitPrice: { amount: 100 },
        taxRate: 19,
      },
    ],
    totals: {
      subtotalHT: { amount: 100 }, // ❌ should be 200
      totalTax: { amount: 38 },
      totalTTC: { amount: 238 },
    },
  });

  assert.equal(result.success, false);
});
