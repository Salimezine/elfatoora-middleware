import assert from "assert";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import {
  cleanupTestData,
  createValidInvoice,
  initializeApp,
  setupTestCustomer,
  TestCustomer,
} from "../helpers/e2e.helpers.js";

let testCustomer: TestCustomer | null = null,
  app: any = null,
  invoiceNumber = "";

const operationId = randomUUID(),
  documentId = randomUUID();

// Test Suite
describe("Documents API E2E Tests (Real App)", () => {
  before(async () => {
    // Initialize test customer and token
    testCustomer = await setupTestCustomer();
    assert(testCustomer, "Failed to setup test customer");

    // Initialize the app
    app = await initializeApp();
    assert(app, "Failed to initialize app");
  });

  after(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  describe("POST /v1/documents - Create Documents", () => {
    it("should accept valid invoice payload with authentication", async () => {
      const payload = createTestPayload();
      const response = await request(app)
        .post("/v1/documents")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .send(payload);
      assert(
        response.status === 202 || response.status === 200,
        `Expected 202 or 200 but got ${response.status}: ${JSON.stringify(response.body)}`,
      );
      assert(
        response.body.operationId || response.body.message,
        `Missing operationId or message in response: ${JSON.stringify(response.body)}`,
      );
    });

    it("should include X-Request-Id header in response", async () => {
      const payload = createTestPayload();
      const response = await request(app)
        .post("/v1/documents")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .send(payload);

      assert(
        response.headers["x-request-id"],
        `Missing X-Request-Id header in response: ${JSON.stringify(response.headers)}`,
      );
    });

    it("should accept multiple invoices in single request", async () => {
      const payload = {
        data: [
          {
            invoice: createValidInvoice(),
            pdf: "JVBERi0xLjQKJeLjz9MNCjEgMCBvYmo=",
          },
          {
            invoice: createValidInvoice(),
            pdf: "JVBERi0xLjQKJeLjz9MNCjEgMCBvYmo=",
          },
        ],
        successUrl: "https://example.com/success",
        failureUrl: "https://example.com/failure",
      };

      const response = await request(app)
        .post("/v1/documents")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .send(payload);

      assert(response.status === 202 || response.status === 200);
    });

    it("should reject invoices with mismatched tax ID", async () => {
      const invoice = createValidInvoice();
      invoice.seller.identifier = "9999999ZZZ999"; // Different tax ID

      const payload = {
        data: [{ invoice, pdf: "JVBERi0xLjQKJeLjz9MNCjEgMCBvYmo=" }],
        successUrl: null,
        failureUrl: null,
      };

      const response = await request(app)
        .post("/v1/documents")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .send(payload);

      logResponse("Mismatched Tax ID", response);
      assert(
        response.status === 403 || response.status === 400,
        `Expected 403 or 400 for mismatched tax ID but got ${response.status}: ${JSON.stringify(response.body)}`,
      );
    });

    it("should validate invoice payload format", async () => {
      const invalidPayload = {
        data: [
          {
            invoice: {
              /* incomplete invoice */
            },
            pdf: "JVBERi0xLjQKJeLjz9MNCjEgMCBvYmo=",
          },
        ],
      };

      const response = await request(app)
        .post("/v1/documents")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .send(invalidPayload);

      assert(
        response.status >= 400,
        `Expected error status (>=400) but got ${response.status}: ${JSON.stringify(response.body)}`,
      );
    });
  });

  it("should require authentication", async () => {
    const response = await request(app).get(
      "/v1/documents/artifacts/INV-TEST-001",
    );

    logResponse("Artifacts Without Auth", response, 401);
    assert.strictEqual(
      response.status,
      401,
      `Expected 401 but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should return artifacts for authenticated requests", async () => {
    const response = await request(app)
      .get("/v1/documents/artifacts/INV-TEST-003")
      .set("Authorization", `Bearer ${testCustomer!.token}`);

    logResponse("Get Artifacts", response);
    assert(
      response.status === 200 || response.status === 404,
      `Expected 200 or 404 but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });
});
