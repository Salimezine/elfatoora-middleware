import assert from "assert";
import type { Express } from "express";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { TEST_TAX_ID } from "../consts.js";
import {
  cleanupTestData,
  createTestPayload,
  createValidInvoice,
  generateFakePdfBase64,
  initializeApp,
  setupTestCustomer,
  TestCustomer,
} from "../helpers/e2e.helpers.js";

let testCustomer: TestCustomer | null = null,
  app: Express;

describe("POST /v1/documents - Create Documents", () => {
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

  it("should require authentication", async () => {
    const payload = createTestPayload();
    const response = await request(app).post("/v1/documents").send(payload);

    assert.strictEqual(
      response.status,
      401,
      `Expected 401 without auth but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should accept valid invoice payload with authentication", async () => {
    const payload = createTestPayload();
    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(payload);

    assert.strictEqual(
      response.status,
      202,
      `Expected 202 but got ${response.status}: ${JSON.stringify(response.body)}`,
    );

    assert(
      response.body.message,
      `Missing message in response: ${JSON.stringify(response.body)}`,
    );

    assert(
      response.body.signatureUUID,
      `Missing signatureUUID in response: ${JSON.stringify(response.body)}`,
    );

    assert(
      response.body.signatureUrl,
      `Missing signatureUrl in response: ${JSON.stringify(response.body)}`,
    );

    assert(
      typeof response.body.signatureUUID === "string",
      `Expected signatureUUID to be a string but got ${typeof response.body.signatureUUID}`,
    );

    assert(
      typeof response.body.signatureUrl === "string",
      `Expected signatureUrl to be a string but got ${typeof response.body.signatureUrl}`,
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
          pdf: generateFakePdfBase64(),
        },
        {
          invoice: createValidInvoice(),
          pdf: generateFakePdfBase64(),
        },
      ],
      successUrl: "https://example.com/success",
      failureUrl: "https://example.com/failure",
    };

    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(payload);

    assert.strictEqual(
      response.status,
      202,
      `Expected 202 but got ${response.status}: ${JSON.stringify(response.body)}`,
    );

    assert(
      response.body.signatureUUID,
      `Missing signatureUUID for batch request: ${JSON.stringify(response.body)}`,
    );
  });

  it("should accept payload with null callback URLs", async () => {
    const payload = createTestPayload({
      successUrl: null,
      failureUrl: null,
    });

    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(payload);

    assert.strictEqual(
      response.status,
      202,
      `Expected 202 with null callbacks but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should accept payload with valid callback URLs", async () => {
    const payload = createTestPayload({
      successUrl: "https://example.com/webhook/success",
      failureUrl: "https://example.com/webhook/failure",
    });

    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(payload);

    assert.strictEqual(
      response.status,
      202,
      `Expected 202 with valid callback URLs but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should reject invoices with mismatched tax ID", async () => {
    const invoice = createValidInvoice();
    // Use a valid fiscal ID format but different from test customer
    invoice.seller.identifier = "9876543ZAM001"; // Different but valid tax ID

    const payload = {
      data: [{ invoice, pdf: generateFakePdfBase64() }],
      successUrl: null,
      failureUrl: null,
    };

    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(payload);

    assert.strictEqual(
      response.status,
      403,
      `Expected 403 for mismatched tax ID but got ${response.status}: ${JSON.stringify(response.body)}`,
    );

    assert(
      response.body.message,
      `Expected error message but got ${JSON.stringify(response.body)}`,
    );

    assert(
      response.body.message.includes("9876543ZAM001"),
      `Expected error message to include mismatched tax ID`,
    );

    assert(
      response.body.message.includes(TEST_TAX_ID),
      `Expected error message to include authenticated customer tax ID`,
    );
  });

  it("should reject payload with empty data array", async () => {
    const invalidPayload = {
      data: [],
      successUrl: null,
      failureUrl: null,
    };

    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(invalidPayload);

    assert(
      response.status >= 400,
      `Expected error status (>=400) for empty data array but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should reject payload with missing data field", async () => {
    const invalidPayload = {
      successUrl: null,
      failureUrl: null,
    };

    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(invalidPayload);

    assert(
      response.status >= 400,
      `Expected error status (>=400) for missing data field but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should reject payload with missing pdf field", async () => {
    const invalidPayload = {
      data: [
        {
          invoice: createValidInvoice(),
          // Missing pdf field
        },
      ],
      successUrl: null,
      failureUrl: null,
    };

    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(invalidPayload);

    assert(
      response.status >= 400,
      `Expected error status (>=400) for missing pdf field but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should reject payload with empty pdf string", async () => {
    const invalidPayload = {
      data: [
        {
          invoice: createValidInvoice(),
          pdf: "",
        },
      ],
      successUrl: null,
      failureUrl: null,
    };

    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(invalidPayload);

    assert(
      response.status >= 400,
      `Expected error status (>=400) for empty pdf string but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should reject invoice with missing header", async () => {
    const invalidInvoice = createValidInvoice();
    delete (invalidInvoice as any).header;

    const payload = {
      data: [{ invoice: invalidInvoice, pdf: generateFakePdfBase64() }],
      successUrl: null,
      failureUrl: null,
    };

    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(payload);

    assert(
      response.status >= 400,
      `Expected error status (>=400) for missing header but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should reject invoice with missing seller", async () => {
    const invalidInvoice = createValidInvoice();
    delete (invalidInvoice as any).seller;

    const payload = {
      data: [{ invoice: invalidInvoice, pdf: generateFakePdfBase64() }],
      successUrl: null,
      failureUrl: null,
    };

    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(payload);

    assert(
      response.status >= 400,
      `Expected error status (>=400) for missing seller but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should reject invoice with missing buyer", async () => {
    const invalidInvoice = createValidInvoice();
    delete (invalidInvoice as any).buyer;

    const payload = {
      data: [{ invoice: invalidInvoice, pdf: generateFakePdfBase64() }],
      successUrl: null,
      failureUrl: null,
    };

    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(payload);

    assert(
      response.status >= 400,
      `Expected error status (>=400) for missing buyer but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should reject invoice with missing items", async () => {
    const invalidInvoice = createValidInvoice();
    delete (invalidInvoice as any).items;

    const payload = {
      data: [{ invoice: invalidInvoice, pdf: generateFakePdfBase64() }],
      successUrl: null,
      failureUrl: null,
    };

    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(payload);

    assert(
      response.status >= 400,
      `Expected error status (>=400) for missing items but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should reject invoice with empty items array", async () => {
    const invalidInvoice = createValidInvoice();
    invalidInvoice.lines = [];

    const payload = {
      data: [{ invoice: invalidInvoice, pdf: generateFakePdfBase64() }],
      successUrl: null,
      failureUrl: null,
    };

    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(payload);

    assert(
      response.status >= 400,
      `Expected error status (>=400) for empty items array but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should reject payload with invalid callback URL format", async () => {
    const payload = {
      data: [
        {
          invoice: createValidInvoice(),
          pdf: generateFakePdfBase64(),
        },
      ],
      successUrl: "not-a-valid-url",
      failureUrl: null,
    };

    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(payload);

    assert(
      response.status >= 400,
      `Expected error status (>=400) for invalid URL format but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });
});
