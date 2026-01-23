import assert from "assert";
import { randomUUID } from "crypto";
import type { Express } from "express";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { db } from "../../db/client.js";
import { DateOnly } from "../../db/schema.js";
import { TEST_CUSTOMER_ID, TEST_TAX_ID } from "../consts.js";
import {
  cleanupTestData,
  createValidInvoice,
  initializeApp,
  setupTestCustomer,
  TestCustomer,
} from "../helpers/e2e.helpers.js";

let testCustomer: TestCustomer | null = null,
  app: Express,
  invoiceNumber = "INV-TEST-001";

describe("GET /v1/documents/status/:invoiceNumber - Document Status", () => {
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
    const response = await request(app).get(
      `/v1/documents/status/${invoiceNumber}`,
    );

    assert.strictEqual(
      response.status,
      401,
      `Expected 401 without auth but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should return document status for authenticated requests", async () => {
    const response = await request(app)
      .get(`/v1/documents/status/${invoiceNumber}`)
      .set("Authorization", `Bearer ${testCustomer!.token}`);

    console.log(response.body);

    assert(
      response.status === 200 || response.status === 404,
      `Expected 200 or 404 but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should include X-Request-Id in response", async () => {
    const response = await request(app)
      .get(`/v1/documents/status/${invoiceNumber}`)
      .set("Authorization", `Bearer ${testCustomer!.token}`);

    assert(
      response.headers["x-request-id"],
      `Missing X-Request-Id header: ${JSON.stringify(response.headers)}`,
    );
  });

  it("should return 404 for document not found", async () => {
    const nonExistentInvoice = "INV-NONEXISTENT-999";
    const response = await request(app)
      .get(`/v1/documents/status/${nonExistentInvoice}`)
      .set("Authorization", `Bearer ${testCustomer!.token}`);

    assert.strictEqual(
      response.status,
      404,
      `Expected 404 for non-existent document but got ${response.status}: ${JSON.stringify(response.body)}`,
    );

    assert.strictEqual(
      response.body.code,
      "DOCUMENT_NOT_FOUND",
      `Expected error code DOCUMENT_NOT_FOUND but got ${response.body.code}`,
    );

    assert(
      response.body.error,
      `Expected error message but got ${JSON.stringify(response.body)}`,
    );

    assert(
      response.body.error.includes(nonExistentInvoice),
      `Expected error message to include invoice number ${nonExistentInvoice}`,
    );
  });

  it("should return valid response body with invoiceNumber and status", async () => {
    const operationId = randomUUID(),
      documentId = randomUUID();

    await db
      .insertInto("tbl_operations")
      .values({
        id: operationId,
        customer_id: TEST_CUSTOMER_ID,
        status: "PENDING",
        failure_callback_url: "", // not used in this test
        success_callback_url: "", // not used in this test
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
      .catch(console.error);

    const doc = createValidInvoice();
    invoiceNumber = doc.header.documentNumber;
    await db
      .insertInto("tbl_documents")
      .values({
        id: documentId,
        operation_id: operationId,
        document_number: doc.header.documentNumber,
        seller_tax_id: TEST_TAX_ID,
        currency: doc.totals.totalTTC.currency,
        source_system: "API",
        document_type: doc.header.type,
        issue_date: doc.header.issueDate as unknown as DateOnly,
        total_ht: doc.totals.subtotalHT.amount,
        total_tva: doc.totals.totalTax.amount,
        total_ttc: doc.totals.totalTTC.amount,
        payload: doc,
        payload_hash: "hash", // dummy hash
        status: "RECEIVED",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
      .catch(console.error);

    // Then check its status
    const response = await request(app)
      .get(`/v1/documents/status/${invoiceNumber}`)
      .set("Authorization", `Bearer ${testCustomer!.token}`);

    assert.strictEqual(
      response.status,
      200,
      `Expected 200 but got ${response.status}: ${JSON.stringify(response.body)}`,
    );

    assert(
      response.body.invoiceNumber,
      `Expected invoiceNumber in response but got ${JSON.stringify(response.body)}`,
    );

    assert.strictEqual(
      response.body.invoiceNumber,
      invoiceNumber,
      `Expected invoiceNumber to be ${invoiceNumber} but got ${response.body.invoiceNumber}`,
    );

    assert(
      response.body.status,
      `Expected status in response but got ${JSON.stringify(response.body)}`,
    );

    assert(
      typeof response.body.status === "string",
      `Expected status to be a string but got ${typeof response.body.status}`,
    );
  });
});
