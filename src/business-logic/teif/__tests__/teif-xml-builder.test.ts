import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { TeifInvoiceXml } from "../teif-types.js";
import { buildTeifXml } from "../teif-xml-builder.js";

test("buildTeifXml - should build valid XML from TEIF invoice object", () => {
  const input: TeifInvoiceXml = {
    TEIF: {
      "@_version": "1.8.8",
      "@_controlingAgency": "TTN",
      InvoiceHeader: {
        MessageSenderIdentifier: {
          "@_type": "I-01",
          "#text": "TAX123456",
        },
        MessageRecieverIdentifier: {
          "@_type": "I-01",
          "#text": "TAX654321",
        },
      },
      InvoiceBody: {
        Bgm: {
          DocumentIdentifier: "INV-001",
          DocumentType: {
            "@_code": "I-11",
            "#text": "Facture",
          },
        },
        Dtm: {
          DateText: [
            {
              "@_format": "ddMMyy",
              "@_functionCode": "I-31",
              "#text": "010124",
            },
          ],
        },
        PartnerSection: {
          PartnerDetails: [],
        },
        LinSection: {
          Lin: [],
        },
      },
    },
  };

  const result = buildTeifXml(input);

  assert.ok(result.includes("<TEIF"));
  assert.ok(result.includes("</TEIF>"));
  assert.ok(
    result.includes("<DocumentIdentifier>INV-001</DocumentIdentifier>"),
  );
  assert.ok(result.includes('version="1.8.8"'));
});

test("buildTeifXml - should suppress empty nodes", () => {
  const input: TeifInvoiceXml = {
    TEIF: {
      "@_version": "1.8.8",
      "@_controlingAgency": "TTN",
      InvoiceHeader: {
        MessageSenderIdentifier: {
          "@_type": "I-01",
          "#text": "TAX123456",
        },
        MessageRecieverIdentifier: {
          "@_type": "I-01",
          "#text": "TAX654321",
        },
      },
      InvoiceBody: {
        Bgm: {
          DocumentIdentifier: "INV-002",
          DocumentType: {
            "@_code": "I-11",
            "#text": "Facture",
          },
        },
        Dtm: {
          DateText: [],
        },
        PartnerSection: {
          PartnerDetails: [],
        },
        LinSection: {
          Lin: [],
        },
      },
    },
  };

  const result = buildTeifXml(input);

  assert.ok(!result.includes("<Description>"));
});

test("buildTeifXml - should handle attributes correctly", () => {
  const input: TeifInvoiceXml = {
    TEIF: {
      "@_version": "1.8.8",
      "@_controlingAgency": "TTN",
      InvoiceHeader: {
        MessageSenderIdentifier: {
          "@_type": "I-01",
          "#text": "TAX123456",
        },
        MessageRecieverIdentifier: {
          "@_type": "I-01",
          "#text": "TAX654321",
        },
      },
      InvoiceBody: {
        Bgm: {
          DocumentIdentifier: "INV-003",
          DocumentType: {
            "@_code": "I-11",
            "#text": "Facture",
          },
        },
        Dtm: {
          DateText: [],
        },
        PartnerSection: {
          PartnerDetails: [],
        },
        LinSection: {
          Lin: [],
        },
      },
    },
  };

  const result = buildTeifXml(input);

  assert.ok(result.includes('version="1.8.8"'));
  assert.ok(result.includes('controlingAgency="TTN"'));
});

test("buildTeifXml - should return string", () => {
  const input: TeifInvoiceXml = {
    TEIF: {
      "@_version": "1.8.8",
      "@_controlingAgency": "TTN",
      InvoiceHeader: {
        MessageSenderIdentifier: {
          "@_type": "I-01",
          "#text": "TAX123456",
        },
        MessageRecieverIdentifier: {
          "@_type": "I-01",
          "#text": "TAX654321",
        },
      },
      InvoiceBody: {
        Bgm: {
          DocumentIdentifier: "INV-004",
          DocumentType: {
            "@_code": "I-11",
            "#text": "Facture",
          },
        },
        Dtm: {
          DateText: [],
        },
        PartnerSection: {
          PartnerDetails: [],
        },
        LinSection: {
          Lin: [],
        },
      },
    },
  };
  const result = buildTeifXml(input);

  assert.strictEqual(typeof result, "string");
  assert.ok(result.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
});
