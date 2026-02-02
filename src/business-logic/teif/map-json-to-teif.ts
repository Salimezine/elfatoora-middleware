import type { Document } from "../../schemas/document.schema.js";
import {
  calculateGrandTotal,
  calculateSubtotal,
  calculateTaxTotal,
} from "../document/calculations.js";
import type {
  TeifInvoiceTaxDetail,
  TeifInvoiceXml,
  TeifLine,
  TeifPartnerDetails,
} from "./teif-types.js";

const formatAmount = (value: number) => value.toFixed(3);

const formatDate = (date: Date | string) =>
  new Date(date).toISOString().slice(0, 10);

const formatDateForTeif = (date: Date | string): string => {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
};

export function mapInvoiceToTeifXml(input: Document): TeifInvoiceXml {
  const subtotal = calculateSubtotal(input.lines);
  const taxTotal = calculateTaxTotal(input.lines);
  const grandTotal = calculateGrandTotal(subtotal, taxTotal);

  return {
    TEIF: {
      "@_controlingAgency": "TTN",
      "@_version": "1.8.8",

      InvoiceHeader: {
        MessageSenderIdentifier: {
          "@_type": "I-01",
          "#text": input.seller.identifier,
        },
        MessageRecieverIdentifier: {
          "@_type": "I-01",
          "#text": input.buyer.identifier,
        },
      },

      InvoiceBody: {
        Bgm: {
          DocumentIdentifier: input.header.documentNumber,
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
              "#text": formatDateForTeif(input.header.issueDate),
            },
            {
              "@_format": "ddMMyy",
              "@_functionCode": "I-32",
              "#text": formatDateForTeif(input.header.issueDate),
            },
          ],
        },

        PartnerSection: {
          PartnerDetails: [
            buildPartnerDetails("I-62", input.seller),
            buildPartnerDetails("I-64", input.buyer),
          ],
        },

        LinSection: {
          Lin: input.lines.map((line, index) => buildLine(index + 1, line)),
        },

        InvoiceMoa: buildInvoiceMoa(subtotal, taxTotal, grandTotal),
        InvoiceTax: buildInvoiceTax(input.lines),
      },
    },
  };
}

function buildPartnerDetails(
  functionCode: string,
  party: any,
): TeifPartnerDetails {
  return {
    "@_functionCode": functionCode,
    Nad: {
      PartnerIdentifier: {
        "@_type": "I-01",
        "#text": party.identifier,
      },
      PartnerName: {
        "@_nameType": "Qualification",
        "#text": party.name,
      },
      PartnerAdresses: {
        "@_lang": "fr",
        StreetName: party.address?.street,
        CityName: party.address?.city,
        CountryIdentificationCode: party.address?.country,
      },
    },
  };
}

function buildLine(lineNumber: number, line: any): TeifLine {
  const lineTotal = line.quantity * line.unitPrice.amount;

  return {
    ItemIdentifier: String(lineNumber),
    LinImd: {
      "@_lang": "fr",
      ItemDescription: line.description,
    },
    LinQty: {
      Quantity: formatAmount(line.quantity),
    },
    LinTax: {
      TaxTypeCode: "VAT",
      TaxRate: formatAmount(line.taxRate),
    },
    LinMoa: {
      UnitPriceMoa: {
        "@_amountTypeCode": "I-179",
        "@_currencyCodeList": "ISO_4217",
        Amount: formatAmount(line.unitPrice.amount),
      },
      LineTotalMoa: {
        "@_amountTypeCode": "I-180",
        "@_currencyCodeList": "ISO_4217",
        Amount: formatAmount(lineTotal),
      },
    },
  };
}

function buildInvoiceMoa(
  subtotal: number,
  taxTotal: number,
  grandTotal: number,
): any {
  return {
    AmountDetails: [
      {
        Moa: {
          "@_amountTypeCode": "I-179",
          "@_currencyCodeList": "ISO_4217",
          Amount: formatAmount(subtotal),
        },
      },
      {
        Moa: {
          "@_amountTypeCode": "I-180",
          "@_currencyCodeList": "ISO_4217",
          Amount: formatAmount(taxTotal),
        },
      },
      {
        Moa: {
          "@_amountTypeCode": "I-176",
          "@_currencyCodeList": "ISO_4217",
          Amount: formatAmount(grandTotal),
        },
      },
    ],
  };
}

function buildInvoiceTax(lines: any[]): any {
  const taxMap = new Map<number, { amount: number; rate: number }>();

  lines.forEach((line) => {
    const rate = line.taxRate;
    const taxAmount = (line.quantity * line.unitPrice.amount * rate) / 100;

    if (taxMap.has(rate)) {
      const existing = taxMap.get(rate)!;
      existing.amount += taxAmount;
    } else {
      taxMap.set(rate, { amount: taxAmount, rate });
    }
  });

  const taxDetails: TeifInvoiceTaxDetail[] = Array.from(taxMap.values()).map(
    (tax) => ({
      Tax: {
        TaxTypeCode: "VAT",
        TaxRate: formatAmount(tax.rate),
      },
      AmountDetails: [
        {
          Moa: {
            "@_amountTypeCode": "I-181",
            "@_currencyCodeList": "ISO_4217",
            Amount: formatAmount(tax.amount),
          },
        },
      ],
    }),
  );

  return {
    InvoiceTaxDetails: taxDetails,
  };
}
