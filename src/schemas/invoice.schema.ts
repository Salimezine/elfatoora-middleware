import { z } from "zod";
import {
  calculateSubtotal,
  calculateWithholding,
  round,
} from "../business-logic/invoice/calculations.js";

/**
 * ---------------------------------------------------------------------
 * Common primitives
 * ---------------------------------------------------------------------
 */

export const MoneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().length(3).default("TND"),
});

export type Money = z.infer<typeof MoneySchema>;

export const AddressSchema = z.object({
  street: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  postalCode: z.string().max(20).optional(),
  country: z.string().length(2).default("TN"),
});

export type Address = z.infer<typeof AddressSchema>;

/**
 * ---------------------------------------------------------------------
 * Parties (Seller / Buyer)
 * ---------------------------------------------------------------------
 */

// Example: 1234567AAM000
const FISCAL_ID_REGEX = /^[0-9]{7}[A-Z][APBFN][MPCNE][0-9]{3}$/;
const CIN_REGEX = /^[0-9]{8}$/;
const RESIDENCE_CARD_REGEX = /^[A-Z0-9]{6,35}$/;

type IdentifierType = "FISCAL_ID" | "CIN" | "RESIDENCE_CARD";

function validateIdentifier(
  identifier: string,
  type: IdentifierType
): string | null {
  if (type === "FISCAL_ID" && !FISCAL_ID_REGEX.test(identifier)) {
    return "Invalid Tunisian fiscal identifier format";
  }

  if (type === "CIN" && !CIN_REGEX.test(identifier)) {
    return "CIN must contain exactly 8 digits";
  }

  if (type === "RESIDENCE_CARD" && !RESIDENCE_CARD_REGEX.test(identifier)) {
    return "Invalid residence card identifier format";
  }

  return null;
}

export const PartySchema = z
  .object({
    identifier: z.string().min(3).max(35),
    identifierType: z.enum(["FISCAL_ID", "CIN", "RESIDENCE_CARD"]),
    name: z.string().min(1).max(200),
    address: AddressSchema.optional(),
    contact: z
      .object({
        email: z.string().email().optional(),
        phone: z.string().max(20).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const error = validateIdentifier(data.identifier, data.identifierType);
    if (error) {
      ctx.addIssue({ code: "custom", path: ["identifier"], message: error });
    }
  });

export type Party = z.infer<typeof PartySchema>;

/**
 * ---------------------------------------------------------------------
 * Delivery location (TEIF LocSection)
 * ---------------------------------------------------------------------
 */

export const DeliveryLocationSchema = z.object({
  name: z.string().max(200).optional(),
  address: AddressSchema,
});

export type DeliveryLocation = z.infer<typeof DeliveryLocationSchema>;

/**
 * ---------------------------------------------------------------------
 * Invoice lines
 * ---------------------------------------------------------------------
 */

export const InvoiceLineSchema = z.object({
  lineNumber: z.number().int().positive(),
  description: z.string().min(1).max(500),
  quantity: z.number().positive(),
  unitPrice: MoneySchema,
  taxRate: z.number().min(0).max(100),
  discountRate: z.number().min(0).max(100).optional(),
});

export type InvoiceLine = z.infer<typeof InvoiceLineSchema>;

/**
 * ---------------------------------------------------------------------
 * Totals (system-verified)
 * ---------------------------------------------------------------------
 */

export const InvoiceTotalsSchema = z.object({
  subtotalHT: MoneySchema,
  totalTax: MoneySchema,
  totalTTC: MoneySchema,
});

export type InvoiceTotals = z.infer<typeof InvoiceTotalsSchema>;

/**
 * ---------------------------------------------------------------------
 * Payment terms (TEIF PytSection)
 * ---------------------------------------------------------------------
 */

export const PaymentTermsSchema = z.object({
  method: z.enum(["CASH", "BANK_TRANSFER", "CHEQUE"]),
  dueDate: z.iso.date(),
  iban: z.string().optional(),
  bankName: z.string().optional(),
});

export type PaymentTerms = z.infer<typeof PaymentTermsSchema>;

/**
 * ---------------------------------------------------------------------
 * Invoice-level allowances / charges (TEIF InvoiceAlc)
 * ---------------------------------------------------------------------
 */

export const InvoiceAllowanceSchema = z.object({
  type: z.enum([
    "DISCOUNT", // Global discount
    "SURCHARGE", // Surcharge
    "WITHHOLDING", // Withholding tax
  ]),
  amount: MoneySchema,
  description: z.string().max(500).optional(),
});

/**
 * ---------------------------------------------------------------------
 * Additional documents (TEIF AdditionnalDocuments)
 * ---------------------------------------------------------------------
 */

export const AdditionalDocumentSchema = z.object({
  reference: z.string().min(1).max(70),
  name: z.string().max(200).optional(),
  date: z.iso.date().optional(),
});

export type AdditionalDocument = z.infer<typeof AdditionalDocumentSchema>;

/**
 * ---------------------------------------------------------------------
 * Header (BGM + DTM abstraction)
 * ---------------------------------------------------------------------
 */

export const InvoiceHeaderSchema = z.object({
  invoiceNumber: z.string().min(1).max(70),
  issueDate: z.iso.date(),
  type: z.enum(["INVOICE", "CREDIT_NOTE"]),
});

export type InvoiceHeader = z.infer<typeof InvoiceHeaderSchema>;

/**
 * ---------------------------------------------------------------------
 * Root invoice schema
 * ---------------------------------------------------------------------
 */

export const InvoiceSchema = z
  .object({
    header: InvoiceHeaderSchema,
    seller: PartySchema,
    buyer: PartySchema,

    deliveryLocation: DeliveryLocationSchema.optional(),

    lines: z.array(InvoiceLineSchema).min(1),

    totals: InvoiceTotalsSchema,

    paymentTerms: PaymentTermsSchema.optional(),

    allowances: z.array(InvoiceAllowanceSchema).optional(),

    additionalDocuments: z.array(AdditionalDocumentSchema).optional(),

    metadata: z
      .object({
        externalReference: z.string().max(100).optional(),
        notes: z.string().max(500).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    const computedSubtotal = calculateSubtotal(data.lines);
    const declaredSubtotal = data.totals.subtotalHT.amount;

    // R1 — Subtotal consistency
    if (computedSubtotal !== declaredSubtotal) {
      ctx.addIssue({
        code: "custom",
        path: ["totals", "subtotalHT", "amount"],
        message: `Subtotal mismatch: expected ${computedSubtotal}, got ${declaredSubtotal}`,
      });
    }

    // R2 — TTC consistency
    const withholding = calculateWithholding(data.allowances);
    const expectedTTC =
      declaredSubtotal + data.totals.totalTax.amount - withholding;

    if (round(expectedTTC) !== data.totals.totalTTC.amount) {
      ctx.addIssue({
        code: "custom",
        path: ["totals", "totalTTC", "amount"],
        message: `Total TTC mismatch: expected ${round(
          expectedTTC
        )}, got ${data.totals.totalTTC.amount}`,
      });
    }

    // R3 — Credit note rules
    if (data.header.type === "CREDIT_NOTE") {
      const allAmounts = [
        data.totals.subtotalHT.amount,
        data.totals.totalTax.amount,
        data.totals.totalTTC.amount,
      ];

      if (allAmounts.some((a) => a > 0)) {
        ctx.addIssue({
          code: "custom",
          path: ["header", "type"],
          message: "Credit note amounts must be zero or negative",
        });
      }
    }
  });

export type Invoice = z.infer<typeof InvoiceSchema>;
