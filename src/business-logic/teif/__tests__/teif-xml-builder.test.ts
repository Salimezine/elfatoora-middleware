import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { TeifInvoiceXml } from "../teif-types.js";
import { buildTeifXml } from "../teif-xml-builder.js";

test("buildTeifXml - should build valid XML from invoice object", () => {
  const input: TeifInvoiceXml = {
    Invoice: {
      Header: {
        InvoiceNumber: "INV-001",
        IssueDate: "2024-01-01",
        InvoiceType: "388",
        Currency: "TND",
      },
      Seller: {} as any,
      Buyer: {} as any,
      Lines: { Line: [] },
      Totals: {} as any,
    },
  };

  const result = buildTeifXml(input);

  assert.ok(result.includes("<Invoice>"));
  assert.ok(result.includes("</Invoice>"));
  assert.ok(result.includes("<InvoiceNumber>INV-001</InvoiceNumber>"));
  assert.ok(result.includes("<IssueDate>2024-01-01</IssueDate>"));
});

test("buildTeifXml - should suppress empty nodes", () => {
  const input: TeifInvoiceXml = {
    Invoice: {
      Header: {
        InvoiceNumber: "INV-002",
        IssueDate: "2024-01-01",
        InvoiceType: "388",
        Currency: "TND",
      },
      Seller: {} as any,
      Buyer: {} as any,
      Lines: { Line: [] },
      Totals: {} as any,
    },
  };

  const result = buildTeifXml(input);

  assert.ok(!result.includes("<Description>"));
});

test("buildTeifXml - should handle attributes", () => {
  const input = {
    Invoice: {
      "@_version": "1.0",
      Header: {
        InvoiceNumber: "INV-003",
        IssueDate: "2024-01-01",
        InvoiceType: "388",
        Currency: "TND",
      },
      Seller: {} as any,
      Buyer: {} as any,
      Lines: { Line: [] },
      Totals: {} as any,
    },
  };

  const result = buildTeifXml(input as any);

  assert.ok(result.includes('version="1.0"'));
});

test("buildTeifXml - should return string", () => {
  const input: TeifInvoiceXml = {
    Invoice: {
      Header: {
        InvoiceNumber: "INV-004",
        IssueDate: "2024-01-01",
        InvoiceType: "388",
        Currency: "TND",
      },
      Seller: {} as any,
      Buyer: {} as any,
      Lines: { Line: [] },
      Totals: {} as any,
    },
  };
  const result = buildTeifXml(input);

  assert.strictEqual(typeof result, "string");
});
