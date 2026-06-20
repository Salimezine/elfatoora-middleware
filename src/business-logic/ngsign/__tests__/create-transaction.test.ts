import assert from "assert";
import { describe, it } from "node:test";
import {
  createSignatureTransaction,
  type CreateSignatureTransactionInput,
} from "../create-transaction.js";

describe("createSignatureTransaction", () => {
  describe("successful transaction creation", () => {
    it("should create a signature transaction with valid input", async () => {
      const testUuid = "123e4567-e89b-12d3-a456-426614174000";

      // Mock fetch globally
      const originalFetch = globalThis.fetch;
      let capturedRequest: any;

      (globalThis.fetch as any) = async (url: string, options: any) => {
        capturedRequest = { url, options };
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            object: { uuid: testUuid },
            message: "Success",
            errorCode: null,
          }),
        };
      };

      try {
        const input: CreateSignatureTransactionInput = {
          invoices: [
            {
              teifXmlContent: Buffer.from("test xml").toString("base64"),
              pdfContent: "base64pdf",
              invoiceNumber: "INV-001",
              callbackUrl: {
                successUrl: "https://example.com/success",
                failureUrl: "https://example.com/failure",
              },
            },
          ],
          callbackUrl: {
            successUrl: "https://example.com/success",
            failureUrl: "https://example.com/failure",
          },
          signerEmail: "user@example.com",
        };

        const result = await createSignatureTransaction(
          input,
          "test-token",
          "TEST",
        );

        assert.strictEqual(result.uuid, testUuid);
        assert.ok(result.url.includes(testUuid));
        assert.ok(result.url.includes("https://sandbox.ng-sign.com"));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should handle multiple invoices in a single transaction", async () => {
      const testUuid = "uuid-12345";
      let capturedBody: any;

      const originalFetch = globalThis.fetch;

      (globalThis.fetch as any) = async (url: string, options: any) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            object: { uuid: testUuid },
            message: "Success",
            errorCode: null,
          }),
        };
      };

      try {
        const input: CreateSignatureTransactionInput = {
          invoices: [
            {
              teifXmlContent: Buffer.from("xml1").toString("base64"),
              pdfContent: "pdf1",
              invoiceNumber: "INV-001",
            },
            {
              teifXmlContent: Buffer.from("xml2").toString("base64"),
              pdfContent: "pdf2",
              invoiceNumber: "INV-002",
            },
          ],
          callbackUrl: {
            successUrl: "https://example.com/success",
            failureUrl: "https://example.com/failure",
          },
          signerEmail: "user@example.com",
        };

        const result = await createSignatureTransaction(input, "test-token");

        assert.strictEqual(result.uuid, testUuid);
        assert.strictEqual(capturedBody.invoices.length, 2);
        assert.strictEqual(capturedBody.invoices[0].invoiceNumber, "INV-001");
        assert.strictEqual(capturedBody.invoices[1].invoiceNumber, "INV-002");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should use fallback callback URLs from global callbackUrl", async () => {
      const testUuid = "uuid-xyz";
      let capturedBody: any;

      const originalFetch = globalThis.fetch;

      (globalThis.fetch as any) = async (url: string, options: any) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            object: { uuid: testUuid },
            message: "Success",
            errorCode: null,
          }),
        };
      };

      try {
        const input: CreateSignatureTransactionInput = {
          invoices: [
            {
              teifXmlContent: Buffer.from("xml").toString("base64"),
              pdfContent: "pdf",
              invoiceNumber: "INV-001",
            },
          ],
          callbackUrl: {
            successUrl: "https://global.com/success",
            failureUrl: "https://global.com/failure",
          },
          signerEmail: "user@example.com",
        };

        await createSignatureTransaction(input, "test-token");

        assert.strictEqual(
          capturedBody.invoices[0].callbackUrl.successUrl,
          "https://global.com/success",
        );
        assert.strictEqual(
          capturedBody.invoices[0].callbackUrl.failureUrl,
          "https://global.com/failure",
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should use invoice-specific callback URLs when provided", async () => {
      const testUuid = "uuid-abc";
      let capturedBody: any;

      const originalFetch = globalThis.fetch;

      (globalThis.fetch as any) = async (url: string, options: any) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            object: { uuid: testUuid },
            message: "Success",
            errorCode: null,
          }),
        };
      };

      try {
        const input: CreateSignatureTransactionInput = {
          invoices: [
            {
              teifXmlContent: Buffer.from("xml").toString("base64"),
              pdfContent: "pdf",
              invoiceNumber: "INV-001",
              callbackUrl: {
                successUrl: "https://invoice.com/success",
                failureUrl: "https://invoice.com/failure",
              },
            },
          ],
          callbackUrl: {
            successUrl: "https://global.com/success",
            failureUrl: "https://global.com/failure",
          },
          signerEmail: "user@example.com",
        };

        await createSignatureTransaction(input, "test-token");

        assert.strictEqual(
          capturedBody.invoices[0].callbackUrl.successUrl,
          "https://invoice.com/success",
        );
        assert.strictEqual(
          capturedBody.invoices[0].callbackUrl.failureUrl,
          "https://invoice.com/failure",
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should support PROD mode", async () => {
      const testUuid = "uuid-prod";
      let capturedUrl: string | undefined;

      const originalFetch = globalThis.fetch;

      (globalThis.fetch as any) = async (url: string, options: any) => {
        capturedUrl = url;
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            object: { uuid: testUuid },
            message: "Success",
            errorCode: null,
          }),
        };
      };

      try {
        const input: CreateSignatureTransactionInput = {
          invoices: [
            {
              teifXmlContent: Buffer.from("xml").toString("base64"),
              pdfContent: "pdf",
              invoiceNumber: "INV-001",
            },
          ],
          callbackUrl: {
            successUrl: "https://example.com/success",
            failureUrl: "https://example.com/failure",
          },
          signerEmail: "user@example.com",
        };

        await createSignatureTransaction(input, "test-token", "PROD");

        assert.ok(capturedUrl?.includes("https://api.ng-sign.com"));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should default to TEST mode when not specified", async () => {
      const testUuid = "uuid-test";
      let capturedUrl: string | undefined;

      const originalFetch = globalThis.fetch;

      (globalThis.fetch as any) = async (url: string, options: any) => {
        capturedUrl = url;
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            object: { uuid: testUuid },
            message: "Success",
            errorCode: null,
          }),
        };
      };

      try {
        const input: CreateSignatureTransactionInput = {
          invoices: [
            {
              teifXmlContent: Buffer.from("xml").toString("base64"),
              pdfContent: "pdf",
              invoiceNumber: "INV-001",
            },
          ],
          callbackUrl: {
            successUrl: "https://example.com/success",
            failureUrl: "https://example.com/failure",
          },
          signerEmail: "user@example.com",
        };

        await createSignatureTransaction(input, "test-token");

        assert.ok(capturedUrl?.includes("https://sandbox.ng-sign.com"));
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("error handling", () => {
    it("should throw an error when response has no uuid", async () => {
      const originalFetch = globalThis.fetch;

      (globalThis.fetch as any) = async () => {
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            object: null,
            message: "Invalid request",
            errorCode: "INVALID_REQUEST",
          }),
        };
      };

      try {
        const input: CreateSignatureTransactionInput = {
          invoices: [
            {
              teifXmlContent: Buffer.from("xml").toString("base64"),
              pdfContent: "pdf",
              invoiceNumber: "INV-001",
            },
          ],
          callbackUrl: {
            successUrl: "https://example.com/success",
            failureUrl: "https://example.com/failure",
          },
          signerEmail: "user@example.com",
        };

        await assert.rejects(
          () => createSignatureTransaction(input, "test-token"),
          (error: any) => {
            assert.ok(
              error.message.includes("NGSign create transaction failed"),
            );
            assert.ok(error.message.includes("Invalid request"));
            assert.ok(error.message.includes("INVALID_REQUEST"));
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should throw an error when response object is undefined", async () => {
      const originalFetch = globalThis.fetch;

      (globalThis.fetch as any) = async () => {
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            message: "Server error",
            errorCode: "SERVER_ERROR",
          }),
        };
      };

      try {
        const input: CreateSignatureTransactionInput = {
          invoices: [
            {
              teifXmlContent: Buffer.from("xml").toString("base64"),
              pdfContent: "pdf",
              invoiceNumber: "INV-001",
            },
          ],
          callbackUrl: {
            successUrl: "https://example.com/success",
            failureUrl: "https://example.com/failure",
          },
          signerEmail: "user@example.com",
        };

        await assert.rejects(
          () => createSignatureTransaction(input, "test-token"),
          (error: any) => {
            assert.ok(
              error.message.includes("NGSign create transaction failed"),
            );
            return true;
          },
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should pass the correct endpoint to ngsignFetch", async () => {
      const testUuid = "uuid-endpoint";
      let capturedUrl: string | undefined;

      const originalFetch = globalThis.fetch;

      (globalThis.fetch as any) = async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            object: { uuid: testUuid },
            message: "Success",
            errorCode: null,
          }),
        };
      };

      try {
        const input: CreateSignatureTransactionInput = {
          invoices: [
            {
              teifXmlContent: Buffer.from("xml").toString("base64"),
              pdfContent: "pdf",
              invoiceNumber: "INV-001",
            },
          ],
          callbackUrl: {
            successUrl: "https://example.com/success",
            failureUrl: "https://example.com/failure",
          },
          signerEmail: "user@example.com",
        };

        await createSignatureTransaction(input, "test-token");

        assert.ok(
          capturedUrl?.includes("/protected/invoice/xml/transaction/create"),
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should pass the token correctly to ngsignFetch", async () => {
      const testUuid = "uuid-token";
      const testToken = "my-secret-token";
      let capturedHeaders: any;

      const originalFetch = globalThis.fetch;

      (globalThis.fetch as any) = async (url: string, options: any) => {
        capturedHeaders = options.headers;
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            object: { uuid: testUuid },
            message: "Success",
            errorCode: null,
          }),
        };
      };

      try {
        const input: CreateSignatureTransactionInput = {
          invoices: [
            {
              teifXmlContent: Buffer.from("xml").toString("base64"),
              pdfContent: "pdf",
              invoiceNumber: "INV-001",
            },
          ],
          callbackUrl: {
            successUrl: "https://example.com/success",
            failureUrl: "https://example.com/failure",
          },
          signerEmail: "user@example.com",
        };

        await createSignatureTransaction(input, testToken);

        assert.strictEqual(
          capturedHeaders.Authorization,
          `Bearer ${testToken}`,
        );
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should use POST method in request", async () => {
      const testUuid = "uuid-method";
      let capturedMethod: string | undefined;

      const originalFetch = globalThis.fetch;

      (globalThis.fetch as any) = async (url: string, options: any) => {
        capturedMethod = options.method;
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            object: { uuid: testUuid },
            message: "Success",
            errorCode: null,
          }),
        };
      };

      try {
        const input: CreateSignatureTransactionInput = {
          invoices: [
            {
              teifXmlContent: Buffer.from("xml").toString("base64"),
              pdfContent: "pdf",
              invoiceNumber: "INV-001",
            },
          ],
          callbackUrl: {
            successUrl: "https://example.com/success",
            failureUrl: "https://example.com/failure",
          },
          signerEmail: "user@example.com",
        };

        await createSignatureTransaction(input, "test-token");

        assert.strictEqual(capturedMethod, "POST");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should include signer email in payload", async () => {
      const testUuid = "uuid-email";
      let capturedBody: any;

      const originalFetch = globalThis.fetch;

      (globalThis.fetch as any) = async (url: string, options: any) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            object: { uuid: testUuid },
            message: "Success",
            errorCode: null,
          }),
        };
      };

      try {
        const signerEmail = "signer@example.com";
        const input: CreateSignatureTransactionInput = {
          invoices: [
            {
              teifXmlContent: Buffer.from("xml").toString("base64"),
              pdfContent: "pdf",
              invoiceNumber: "INV-001",
            },
          ],
          callbackUrl: {
            successUrl: "https://example.com/success",
            failureUrl: "https://example.com/failure",
          },
          signerEmail,
        };

        await createSignatureTransaction(input, "test-token");

        assert.strictEqual(capturedBody.signerEmail, signerEmail);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("should properly encode XML content to base64", async () => {
      const testUuid = "uuid-encoding";
      let capturedBody: any;

      const originalFetch = globalThis.fetch;

      (globalThis.fetch as any) = async (url: string, options: any) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            object: { uuid: testUuid },
            message: "Success",
            errorCode: null,
          }),
        };
      };

      try {
        const xmlContent = Buffer.from("<xml>test</xml>").toString("base64");
        const input: CreateSignatureTransactionInput = {
          invoices: [
            {
              teifXmlContent: xmlContent,
              pdfContent: "pdf",
              invoiceNumber: "INV-001",
            },
          ],
          callbackUrl: {
            successUrl: "https://example.com/success",
            failureUrl: "https://example.com/failure",
          },
          signerEmail: "user@example.com",
        };

        await createSignatureTransaction(input, "test-token");

        assert.ok(capturedBody.invoices[0].invoiceTIEF);
        assert.ok(typeof capturedBody.invoices[0].invoiceTIEF === "string");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe("payload construction", () => {
    it("should properly map invoice data to payload", async () => {
      const testUuid = "uuid-map";
      let capturedBody: any;

      const originalFetch = globalThis.fetch;

      (globalThis.fetch as any) = async (url: string, options: any) => {
        capturedBody = JSON.parse(options.body);
        return {
          ok: true,
          text: async () => "",
          json: async () => ({
            object: { uuid: testUuid },
            message: "Success",
            errorCode: null,
          }),
        };
      };

      try {
        const input: CreateSignatureTransactionInput = {
          invoices: [
            {
              teifXmlContent: Buffer.from("xml").toString("base64"),
              pdfContent: "pdfcontent",
              invoiceNumber: "INV-001",
            },
          ],
          callbackUrl: {
            successUrl: "https://example.com/success",
            failureUrl: "https://example.com/failure",
          },
          signerEmail: "user@example.com",
        };

        await createSignatureTransaction(input, "test-token");

        assert.strictEqual(
          capturedBody.invoices[0].invoiceFileB64,
          "pdfcontent",
        );
        assert.strictEqual(capturedBody.invoices[0].invoiceNumber, "INV-001");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
