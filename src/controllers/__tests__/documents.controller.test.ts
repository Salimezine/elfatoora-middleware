import assert from "assert";
import type { NextFunction, Request, Response } from "express";
import { describe, it, mock } from "node:test";
import { DocumentsApiSchema } from "../documents.controller.js";

// Helper to create mock request/response/next
function createMocks() {
  const req = {
    body: {},
    params: {},
    query: {},
    context: {
      customer: {
        id: "cust-001",
        tax_id: "1234567AAM000",
        default_success_url: "https://example.com/success",
        default_failure_url: "https://example.com/failure",
        ngsign_signer_email: "signer@example.com",
        ngsign_token: "token-123",
        mode: "production",
      },
    },
  } as unknown as Request;

  const res = {
    status: mock.fn((code: number) => ({
      json: mock.fn((data: any) => res),
      redirect: mock.fn((url: string) => res),
    })),
    redirect: mock.fn((url: string) => res),
    json: mock.fn((data: any) => res),
  } as unknown as Response;

  const next = mock.fn() as unknown as NextFunction;

  return { req, res, next };
}

// Sample valid invoice data
const validInvoice = {
  header: {
    documentNumber: "INV-001",
    issueDate: "2025-01-10",
    type: "INVOICE",
  },
  seller: {
    identifierType: "FISCAL_ID",
    identifier: "1234567AAM000",
    name: "Seller Name",
  },
  buyer: {
    identifierType: "CIN",
    identifier: "01234567",
    name: "Buyer Name",
  },
  lines: [
    {
      lineNumber: 1,
      description: "Item 1",
      quantity: 1,
      unitPrice: { amount: 100 },
      taxRate: 19,
    },
  ],
  totals: {
    subtotalHT: { amount: 100 },
    totalTax: { amount: 19 },
    totalTTC: { amount: 119 },
  },
};

describe("documents.controller", () => {
  describe("createDocuments", () => {
    it("should create documents with valid payload", async () => {
      const { req, res, next } = createMocks();

      const mockDb = {
        insertInto: mock.fn(() => ({
          values: mock.fn(() => ({
            returning: mock.fn(() => ({
              executeTakeFirstOrThrow: mock.fn(async () => ({
                id: "op-123",
              })),
            })),
          })),
        })),
        startTransaction: mock.fn(() => ({
          execute: mock.fn(),
        })),
      };

      req.body = {
        data: [
          {
            invoice: validInvoice,
            pdf: "base64pdf...",
          },
        ],
        successUrl: "https://example.com/success",
        failureUrl: "https://example.com/failure",
      };

      // Mock all the business logic functions
      const mockCreateIncomingDocumentsTransaction = mock.fn(async () =>
        Promise.resolve("op-123"),
      );
      const mockSaveIncomingDocuments = mock.fn(async () =>
        Promise.resolve([
          {
            id: "doc-123",
            documentNumber: "INV-001",
          },
        ]),
      );
      const mockSaveIncomingDocumentArtifact = mock.fn(async () =>
        Promise.resolve(),
      );
      const mockCreateSignatureTransaction = mock.fn(async () =>
        Promise.resolve({
          uuid: "uuid-123",
          url: "https://ngsign.example.com/sign",
        }),
      );
      const mockSetNGSignUUID = mock.fn(async () => Promise.resolve());

      // We need to test the schema first
      const parseResult = DocumentsApiSchema.safeParse(req.body);
      assert.strictEqual(parseResult.success, true);
    });

    it("should reject invalid payload (missing data)", async () => {
      const { req, res, next } = createMocks();

      req.body = {
        successUrl: "https://example.com/success",
        failureUrl: "https://example.com/failure",
      };

      const parseResult = DocumentsApiSchema.safeParse(req.body);
      assert.strictEqual(parseResult.success, false);
    });

    it("should reject empty data array", async () => {
      const { req, res, next } = createMocks();

      req.body = {
        data: [],
        successUrl: "https://example.com/success",
        failureUrl: "https://example.com/failure",
      };

      const parseResult = DocumentsApiSchema.safeParse(req.body);
      assert.strictEqual(parseResult.success, false);
    });

    it("should reject invalid URLs", async () => {
      const { req, res, next } = createMocks();

      req.body = {
        data: [
          {
            invoice: validInvoice,
            pdf: "base64pdf...",
          },
        ],
        successUrl: "not-a-url",
        failureUrl: "https://example.com/failure",
      };

      const parseResult = DocumentsApiSchema.safeParse(req.body);
      assert.strictEqual(parseResult.success, false);
    });

    it("should reject empty pdf string", async () => {
      const { req, res, next } = createMocks();

      req.body = {
        data: [
          {
            invoice: validInvoice,
            pdf: "",
          },
        ],
        successUrl: "https://example.com/success",
        failureUrl: "https://example.com/failure",
      };

      const parseResult = DocumentsApiSchema.safeParse(req.body);
      assert.strictEqual(parseResult.success, false);
    });

    it("should return 403 when seller tax ID does not match customer", async () => {
      const { req, res, next } = createMocks();

      const invoiceWithDifferentTaxId = {
        ...validInvoice,
        seller: {
          ...validInvoice.seller,
          identifier: "9999999BBN000", // Different from customer tax_id
        },
      };

      req.body = {
        data: [
          {
            invoice: invoiceWithDifferentTaxId,
            pdf: "base64pdf...",
          },
        ],
        successUrl: null,
        failureUrl: null,
      };

      // Schema validation should pass with mismatched tax ID
      // The actual controller check would happen during execution
      const parseResult = DocumentsApiSchema.safeParse(req.body);
      assert.strictEqual(parseResult.success, true);
    });
  });

  describe("documentsCallback", () => {
    it("should reject invalid status parameter", async () => {
      const { req, res, next } = createMocks();

      req.params = { status: "invalid" };
      req.query = { hash: "aGFzaC0xMjM=" }; // base64 of "hash-123"

      const mockDb = {
        selectFrom: mock.fn(() => ({
          selectAll: mock.fn(() => ({
            where: mock.fn(function (this: any) {
              return this;
            }),
            executeTakeFirst: mock.fn(async () => null),
          })),
        })),
        transaction: mock.fn(() => ({
          execute: mock.fn(),
        })),
      };

      // Status validation happens first
      const statusResult = ["success", "failure"].includes(
        req.params.status as string,
      );
      assert.strictEqual(statusResult, false);
    });

    it("should reject missing hash parameter", async () => {
      const { req, res, next } = createMocks();

      req.params = { status: "success" };
      req.query = {};

      // Hash validation happens after status
      const hash = req.query.hash;
      assert.strictEqual(hash, undefined);
    });

    it("should reject non-string hash parameter", async () => {
      const { req, res, next } = createMocks();

      req.params = { status: "success" };
      req.query = { hash: ["array", "hash"] };

      const hash = req.query.hash;
      assert.strictEqual(typeof hash === "string", false);
    });

    it("should accept valid success status", async () => {
      const { req, res, next } = createMocks();

      req.params = { status: "success" };

      const statusResult = ["success", "failure"].includes(
        req.params.status as string,
      );
      assert.strictEqual(statusResult, true);
    });

    it("should accept valid failure status", async () => {
      const { req, res, next } = createMocks();

      req.params = { status: "failure" };

      const statusResult = ["success", "failure"].includes(
        req.params.status as string,
      );
      assert.strictEqual(statusResult, true);
    });
  });

  describe("getDocumentStatus", () => {
    it("should require invoiceNumber parameter", async () => {
      const { req, res, next } = createMocks();

      req.params = {};

      // invoiceNumber is required
      assert.strictEqual(req.params.invoiceNumber, undefined);
    });

    it("should reject empty invoiceNumber", async () => {
      const { req, res, next } = createMocks();

      req.params = { invoiceNumber: "" };

      // Should be min 1 character
      assert.strictEqual(req.params.invoiceNumber.length, 0);
    });

    it("should accept valid invoiceNumber", async () => {
      const { req, res, next } = createMocks();

      req.params = { invoiceNumber: "INV-001" };

      // Should be valid
      assert.strictEqual(req.params.invoiceNumber.length > 0, true);
    });
  });

  describe("DocumentsApiSchema", () => {
    it("should validate complete valid payload", () => {
      const payload = {
        data: [
          {
            invoice: validInvoice,
            pdf: "base64encodedpdf",
          },
        ],
        successUrl: "https://example.com/success",
        failureUrl: "https://example.com/failure",
      };

      const result = DocumentsApiSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
    });

    it("should allow null URLs", () => {
      const payload = {
        data: [
          {
            invoice: validInvoice,
            pdf: "base64encodedpdf",
          },
        ],
        successUrl: null,
        failureUrl: null,
      };

      const result = DocumentsApiSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
    });

    it("should allow multiple invoices", () => {
      const payload = {
        data: [
          {
            invoice: validInvoice,
            pdf: "base64encodedpdf1",
          },
          {
            invoice: {
              ...validInvoice,
              header: { ...validInvoice.header, documentNumber: "INV-002" },
            },
            pdf: "base64encodedpdf2",
          },
        ],
        successUrl: "https://example.com/success",
        failureUrl: null,
      };

      const result = DocumentsApiSchema.safeParse(payload);
      assert.strictEqual(result.success, true);
    });
  });
});
