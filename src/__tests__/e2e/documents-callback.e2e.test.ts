import assert from "assert";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { db } from "../../db/client.js";
import type { DateOnly } from "../../db/schema.js";
import { TEST_CUSTOMER_ID, TEST_TAX_ID } from "../consts.js";
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
  documentId = randomUUID(),
  hash = Buffer.from(`${operationId};${documentId}`).toString("base64");

const failureUrl = "https://example.com/failure";
const successUrl = "https://example.com/success";

describe("POST /v1/documents/callback/:status - Webhook Callbacks", () => {
  before(async () => {
    // Initialize test customer and token
    testCustomer = await setupTestCustomer();
    assert(testCustomer, "Failed to setup test customer");

    await db
      .insertInto("tbl_operations")
      .values({
        id: operationId,
        customer_id: TEST_CUSTOMER_ID,
        status: "PENDING",
        failure_callback_url: failureUrl,
        success_callback_url: successUrl, // not used in this test
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

    // Initialize the app
    app = await initializeApp();
    assert(app, "Failed to initialize app");
  });

  after(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  describe("Request validation", () => {
    it("should reject invalid status param with 400", async () => {
      const response = await request(app)
        .post("/v1/documents/callback/invalid-status")
        .query({ hash: "dGVzdGhhc2g=" })
        .send({ xmlBase64: "dGVzdA==", invoiceNumber: "INV-001" });
      assert.strictEqual(
        response.status,
        400,
        "Expected 400 for invalid status",
      );
      assert(response.body.error, "Expected error message for invalid status");
    });

    it("should reject missing hash query param with 400", async () => {
      const response = await request(app)
        .post("/v1/documents/callback/success")
        .send({ xmlBase64: "dGVzdA==", invoiceNumber: "INV-001" });

      assert.strictEqual(response.status, 400, "Expected 400 for missing hash");
      assert(response.body.error, "Expected error message for missing hash");
    });

    it("should return error for base64 hash decoding to non-existent operation", async () => {
      const uuid = randomUUID();
      const invalidHash = Buffer.from(`${uuid};${uuid}`).toString("base64");
      const response = await request(app)
        .post("/v1/documents/callback/success")
        .query({ hash: invalidHash })
        .send({ xmlBase64: "dGVzdA==", invoiceNumber: "INV-001" });
      assert.strictEqual(
        response.status,
        404,
        "Expected 404 for non-existent operation",
      );
      // Verify no DB writes occurred
      const operationExists = await db
        .selectFrom("tbl_operations")
        .where("id", "=", uuid)
        .selectAll()
        .executeTakeFirst()
        .catch(console.error);
      assert(!operationExists, "Operation should not be created");
    });
  });

  describe("Failure flow (status=failure)", () => {
    it("should update DB and redirect to operation failure_callback_url", async () => {
      // Create a test operation with failure URL
      const failureUrl = "https://example.com/failure";

      const response = await request(app)
        .post("/v1/documents/callback/failure")
        .query({ hash })
        .send({ xmlBase64: "dGVzdA==", invoiceNumber });

      assert(
        response.status === 302 || response.status === 303,
        `Expected 302 or 303 but got ${response.status}`,
      );
      assert.strictEqual(response.headers.location, failureUrl);

      // Verify DB was updated
      const operation = await db
        .selectFrom("tbl_operations")
        .where("id", "=", operationId)
        .selectAll()
        .executeTakeFirst();
      assert.strictEqual(operation?.status, "FAILED");
    });

    it("should return 200 JSON response when no redirect URLs exist", async () => {
      await db
        .updateTable("tbl_operations")
        .set({ failure_callback_url: "", success_callback_url: "" })
        .where("id", "=", operationId)
        .execute();

      const response = await request(app)
        .post("/v1/documents/callback/failure")
        .query({ hash })
        .send({ xmlBase64: "dGVzdA==", invoiceNumber: "INV-FAIL-003" });

      assert.strictEqual(
        response.status,
        200,
        `Expected 200 but got ${response.status}`,
      );
      assert(response.body.message || response.body.status);
      assert(!response.headers.location);
    });

    it("should be idempotent for already FAILED operations", async () => {
      const response = await request(app)
        .post("/v1/documents/callback/failure")
        .query({ hash })
        .send({ xmlBase64: "dGVzdA==", invoiceNumber: "INV-FAIL-REPEAT" });

      assert.strictEqual(response.status, 200);
      const operation = await db
        .selectFrom("tbl_operations")
        .where("id", "=", operationId)
        .selectAll()
        .executeTakeFirst();
      assert.strictEqual(operation?.status, "FAILED");
    });
  });

  describe("Success flow (status=success)", () => {
    it("should update documents to TTN_PENDING, save artifacts, and redirect to success URL", async () => {
      // Reset the operation status to PENDING
      await db
        .updateTable("tbl_operations")
        .set({
          status: "PENDING",
          failure_callback_url: failureUrl,
          success_callback_url: successUrl,
        })
        .where("id", "=", operationId)
        .execute();

      const xmlBase64 = Buffer.from("<invoice>test</invoice>").toString(
        "base64",
      );
      const response = await request(app)
        .post("/v1/documents/callback/success")
        .query({ hash })
        .send({ xmlBase64, invoiceNumber });
      assert(
        response.status === 302 || response.status === 303,
        `Unexpected status code: ${response.status}`,
      );
      assert.strictEqual(
        response.headers.location,
        successUrl,
        "Unexpected redirect URL",
      );

      // Verify operation status updated
      const operation = await db
        .selectFrom("tbl_documents")
        .where("id", "=", documentId)
        .select(["status"])
        .executeTakeFirst()
        .catch(console.error);

      assert.strictEqual(
        operation?.status,
        "TTN_PENDING",
        "Document not updated to TTN_PENDING",
      );
    });

    it("should return 200 JSON response when no redirect URLs exist", async () => {
      const xmlBase64 = Buffer.from("<invoice>test</invoice>").toString(
        "base64",
      );
      // Remove callback URLs
      await db
        .updateTable("tbl_operations")
        .set({ failure_callback_url: "", success_callback_url: "" })
        .where("id", "=", operationId)
        .execute();

      const response = await request(app)
        .post("/v1/documents/callback/success")
        .query({ hash })
        .send({ xmlBase64, invoiceNumber });

      assert.strictEqual(response.status, 200);
      assert(response.body.message || response.body.status);
      assert(!response.headers.location);
    });
  });

  describe("Payload validation", () => {
    it("should rollback transaction when missing xmlBase64 in payload item", async () => {
      // Reset the data
      await db
        .updateTable("tbl_operations")
        .set({ status: "PENDING" })
        .where("id", "=", operationId)
        .execute();

      const response = await request(app)
        .post("/v1/documents/callback/success")
        .query({ hash })
        .send({ invoiceNumber: "INV-INVALID-001" });

      assert(
        response.status >= 400,
        `Unexpected status code: ${response.status}`,
      );

      // Verify operation status unchanged
      const operation = await db
        .selectFrom("tbl_operations")
        .where("id", "=", operationId)
        .select(["status"])
        .executeTakeFirst();
      assert.strictEqual(operation?.status, "PENDING");
    });

    it("should rollback transaction when missing invoiceNumber in payload item", async () => {
      // Reset the data
      await db
        .updateTable("tbl_operations")
        .set({ status: "PENDING" })
        .where("id", "=", operationId)
        .execute();

      const xmlBase64 = Buffer.from("<invoice>test</invoice>").toString(
        "base64",
      );
      const response = await request(app)
        .post("/v1/documents/callback/success")
        .query({ hash })
        .send({ xmlBase64 });

      assert(response.status >= 400);

      const operation = await db
        .selectFrom("tbl_operations")
        .where("id", "=", operationId)
        .selectAll()
        .executeTakeFirst();
      assert.strictEqual(operation?.status, "PENDING");
    });
  });
});
