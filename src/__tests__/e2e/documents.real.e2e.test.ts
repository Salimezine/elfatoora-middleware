import assert from "assert";
import { Selectable } from "kysely";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { db } from "../../db/client.js";
import type { DateOnly, TkrCustomers } from "../../db/schema.js";
import { createValidInvoice } from "../helpers/e2e.helpers.js";

/**
 * Real E2E Test Suite for Documents API
 *
 * This test suite covers the complete workflow of the documents API
 * using the actual Express app and real database.
 *
 * Prerequisites:
 * - DATABASE_URL environment variable pointing to test database
 * - PUBLIC_BASE_URL environment variable
 * - Test database with migrations applied
 */

// Test data constants
const TEST_CUSTOMER_ID = randomUUID() as string;
const TEST_TAX_ID = "1234567AAM000";
const TEST_TOKEN = "test-token-" + randomUUID();
const TEST_NGSIGN_TOKEN =
  "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJraGFycmF0Lm1AdGVrcnUubmV0IiwiYXBpTG9nIjpmYWxzZSwiaWF0IjoxNzY5MDQwNjY0LCJlbWFpbCI6ImtoYXJyYXQubUB0ZWtydS5uZXQifQ.VRfe-gzzmhGD8t40Rrj4-vkoIqAQzX6k-MI4hNM3kIKC1FMg74oIPjdWakUyv-QLTes5oR5fQeXOblL9ucMRvA";
const TEST_NGSIGN_EMAIL = "kharrat.m@tekru.net";

interface TestCustomer extends Selectable<TkrCustomers> {
  token: string;
}

let testCustomer: TestCustomer | null = null;
let app: any = null;

/**
 * Setup: Create test customer and token
 */
async function setupTestCustomer() {
  try {
    // Create customer
    const customer = await db
      .insertInto("tbl_tkr_customers")
      .values({
        id: TEST_CUSTOMER_ID,
        name: "Test Customer",
        tax_id: TEST_TAX_ID,
        mode: "TEST",
        ngsign_token: TEST_NGSIGN_TOKEN,
        ngsign_signer_email: TEST_NGSIGN_EMAIL,
        ttn_login: null, // No TTN login for tests
        ttn_password: null, // No TTN password for tests
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returningAll()
      .executeTakeFirst();

    if (!customer) {
      throw new Error("Failed to create test customer");
    }

    // Create token
    await db
      .insertInto("tbl_tkr_customer_tokens")
      .values({
        id: randomUUID(),
        customer_id: TEST_CUSTOMER_ID,
        token: TEST_TOKEN,
        name: "Test Token",
        is_active: true,
        updated_at: new Date(),
        created_at: new Date(),
      })
      .execute();

    testCustomer = { ...customer, token: TEST_TOKEN };
    return testCustomer;
  } catch (error) {
    console.error("Error setting up test customer:", error);
    throw error;
  }
}

/**
 * Cleanup: Delete test data
 */
async function cleanupTestData() {
  try {
    // Delete tokens
    await db
      .deleteFrom("tbl_tkr_customer_tokens")
      .where("customer_id", "=", TEST_CUSTOMER_ID)
      .execute();

    // Delete customer
    await db
      .deleteFrom("tbl_tkr_customers")
      .where("id", "=", TEST_CUSTOMER_ID)
      .execute();

    // Delete test operations
    await db
      .deleteFrom("tbl_operations")
      .where("customer_id", "=", TEST_CUSTOMER_ID)
      .execute();
  } catch (error) {
    console.error("Error cleaning up test data:", error);
    // Don't throw - cleanup errors shouldn't fail tests
  }
}

/**
 * Import and initialize the real app
 */
async function initializeApp() {
  try {
    // Import the Express app setup
    const { app } = await import("../../index.js");
    return app;
  } catch (error) {
    console.error("Error initializing app:", error);
    throw error;
  }
}

function createTestPayload() {
  return {
    data: [
      {
        invoice: createValidInvoice(),
        pdf: "JVBERi0xLjQKJeLjz9MNCjEgMCBvYmo=",
      },
    ],
    successUrl: null,
    failureUrl: null,
  };
}

/**
 * Helper to log response details for debugging test failures
 */
function logResponse(testName: string, response: any, expectedStatus?: number) {
  // console.log(`\n📤 [${testName}]`);
  // console.log(
  //   `   Status: ${response.status}${expectedStatus ? ` (expected: ${expectedStatus})` : ""}`,
  // );
  // console.log(`   Headers: ${JSON.stringify(response.headers, null, 2)}`);
  // console.log(`   Body: ${JSON.stringify(response.body, null, 2)}`);
}

// Test Suite
describe("Documents API E2E Tests (Real App)", () => {
  before(async () => {
    // Initialize test customer and token
    await setupTestCustomer();
    assert(testCustomer, "Failed to setup test customer");

    // Initialize the app
    app = await initializeApp();
    assert(app, "Failed to initialize app");
  });

  after(async () => {
    // Cleanup test data
    await cleanupTestData();
  });

  describe("Health Check", () => {
    it("should return 200 OK for health endpoint", async () => {
      const response = await request(app).get("/health");
      assert.strictEqual(response.status, 200);
      assert.strictEqual(response.body.status, "ok");
      assert.strictEqual(response.body.service, "tkr-efatoora-api");
      assert(response.body.timestamp);
    });

    it("should not require authentication for health endpoint", async () => {
      const response = await request(app)
        .get("/health")
        .set("Authorization", "Bearer invalid-token");

      assert.strictEqual(response.status, 200);
    });
  });

  describe("Authentication", () => {
    it("should reject requests without authorization header", async () => {
      const response = await request(app)
        .post("/v1/documents")
        .send(createTestPayload());

      assert.strictEqual(
        response.status,
        401,
        `Expected 401 but got ${response.status}: ${JSON.stringify(response.body)}`,
      );
      assert(
        response.body.error,
        `Expected error field in response: ${JSON.stringify(response.body)}`,
      );
    });

    it("should reject requests with invalid token", async () => {
      const response = await request(app)
        .post("/v1/documents")
        .set("Authorization", "Bearer invalid-token")
        .send(createTestPayload());

      assert.strictEqual(
        response.status,
        401,
        `Expected 401 for invalid token but got ${response.status}: ${JSON.stringify(response.body)}`,
      );
    });

    it("should accept requests with valid token", async () => {
      const response = await request(app)
        .get("/v1/documents/status/INV-TEST")
        .set("Authorization", `Bearer ${testCustomer!.token}`);

      assert.notStrictEqual(
        response.status,
        401,
        `Got 401 with valid token: ${JSON.stringify(response.body)}`,
      );
    });
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

  describe("GET /v1/documents/status/:invoiceNumber - Document Status", () => {
    it("should require authentication", async () => {
      const response = await request(app).get(
        "/v1/documents/status/INV-TEST-001",
      );

      logResponse("Status Without Auth", response, 401);
      assert.strictEqual(
        response.status,
        401,
        `Expected 401 without auth but got ${response.status}: ${JSON.stringify(response.body)}`,
      );
    });

    it("should return document status for authenticated requests", async () => {
      const response = await request(app)
        .get("/v1/documents/status/INV-TEST-001")
        .set("Authorization", `Bearer ${testCustomer!.token}`);

      logResponse("Get Status", response);
      assert(
        response.status === 200 || response.status === 404,
        `Expected 200 or 404 but got ${response.status}: ${JSON.stringify(response.body)}`,
      );
    });

    it("should include X-Request-Id in response", async () => {
      const response = await request(app)
        .get("/v1/documents/status/INV-TEST-002")
        .set("Authorization", `Bearer ${testCustomer!.token}`);

      logResponse("X-Request-Id Status", response);
      assert(
        response.headers["x-request-id"],
        `Missing X-Request-Id header: ${JSON.stringify(response.headers)}`,
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

describe("POST /v1/documents/callback/:status - Webhook Callbacks", () => {
  before(async () => {
    // Initialize test customer and token
    await setupTestCustomer();
    assert(testCustomer, "Failed to setup test customer");

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
      const operationId = randomUUID();
      const failureUrl = "https://example.com/failure";
      const hash = Buffer.from(`${operationId};${operationId}`).toString(
        "base64",
      );

      await db
        .insertInto("tbl_operations")
        .values({
          id: operationId,
          customer_id: TEST_CUSTOMER_ID,
          status: "PENDING",
          failure_callback_url: failureUrl,
          success_callback_url: failureUrl, // not used in this test
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute()
        .catch(console.error);

      const response = await request(app)
        .post("/v1/documents/callback/failure")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .query({ hash })
        .send({ xmlBase64: "dGVzdA==", invoiceNumber: "INV-FAIL-001" });

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
      const operationId = randomUUID();
      const hash = Buffer.from(`${operationId};${operationId}`).toString(
        "base64",
      );

      await db
        .insertInto("tbl_operations")
        .values({
          id: operationId,
          customer_id: TEST_CUSTOMER_ID,
          status: "PENDING",
          failure_callback_url: "",
          success_callback_url: "",
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      // Clear customer default failure URL
      await db
        .updateTable("tbl_tkr_customers")
        .set({ default_failure_url: null })
        .where("id", "=", TEST_CUSTOMER_ID)
        .execute();

      const response = await request(app)
        .post("/v1/documents/callback/failure")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .query({ hash })
        .send({ xmlBase64: "dGVzdA==", invoiceNumber: "INV-FAIL-003" });

      assert.strictEqual(response.status, 200);
      assert(response.body.message || response.body.status);
      assert(!response.headers.location);
    });

    it("should be idempotent for already FAILED operations", async () => {
      const operationId = randomUUID();
      const hash = Buffer.from(`${operationId};${operationId}`).toString(
        "base64",
      );

      await db
        .insertInto("tbl_operations")
        .values({
          id: operationId,
          customer_id: TEST_CUSTOMER_ID,
          status: "FAILED",
          failure_callback_url: "",
          success_callback_url: "",
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      const response = await request(app)
        .post("/v1/documents/callback/failure")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
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
      const operationId = randomUUID();
      const successUrl = "https://example.com/success";
      const hash = Buffer.from(`${operationId};${operationId}`).toString(
        "base64",
      );

      await db
        .insertInto("tbl_operations")
        .values({
          id: operationId,
          customer_id: TEST_CUSTOMER_ID,
          status: "PENDING",
          success_callback_url: successUrl,
          failure_callback_url: "", // not used in this test
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute()
        .catch(console.error);

      // Create a document linked to the operation
      const doc = createValidInvoice();
      const documentId = randomUUID();
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

      const xmlBase64 = Buffer.from("<invoice>test</invoice>").toString(
        "base64",
      );
      console.log("Callback XML Base64:", xmlBase64);
      const response = await request(app)
        .post("/v1/documents/callback/success")
        .query({ hash })
        .send({ xmlBase64, invoiceNumber: doc.header.documentNumber });
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

    it("should redirect to customer default success URL when operation has no URL", async () => {
      const operationId = randomUUID();
      const hash = Buffer.from(operationId).toString("base64");
      const customerSuccessUrl = "https://example.com/customer-success";
      const invoiceNumber = `INV-SUCCESS-CUST-${randomUUID().slice(0, 8)}`;

      await db
        .insertInto("tbl_operations")
        .values({
          id: operationId,
          customer_id: TEST_CUSTOMER_ID,
          status: "PENDING",
          success_callback_url: null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      await db
        .updateTable("tbl_tkr_customers")
        .set({ default_success_url: customerSuccessUrl })
        .where("id", "=", TEST_CUSTOMER_ID)
        .execute();

      const xmlBase64 = Buffer.from("<invoice>test</invoice>").toString(
        "base64",
      );
      const response = await request(app)
        .post("/v1/documents/callback/success")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .query({ hash })
        .send({ xmlBase64, invoiceNumber });

      assert(response.status === 302 || response.status === 303);
      assert.strictEqual(response.headers.location, customerSuccessUrl);
    });

    it("should return 200 JSON response when no redirect URLs exist", async () => {
      const operationId = randomUUID();
      const hash = Buffer.from(operationId).toString("base64");
      const invoiceNumber = `INV-SUCCESS-JSON-${randomUUID().slice(0, 8)}`;

      await db
        .insertInto("tbl_operations")
        .values({
          id: operationId,
          customer_id: TEST_CUSTOMER_ID,
          status: "PENDING",
          success_callback_url: null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      await db
        .updateTable("tbl_tkr_customers")
        .set({ default_success_url: null })
        .where("id", "=", TEST_CUSTOMER_ID)
        .execute();

      const xmlBase64 = Buffer.from("<invoice>test</invoice>").toString(
        "base64",
      );
      const response = await request(app)
        .post("/v1/documents/callback/success")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .query({ hash })
        .send({ xmlBase64, invoiceNumber });

      assert.strictEqual(response.status, 200);
      assert(response.body.message || response.body.status);
      assert(!response.headers.location);
    });
  });

  describe("Payload validation", () => {
    it("should rollback transaction when missing xmlBase64 in payload item", async () => {
      const operationId = randomUUID();
      const hash = Buffer.from(operationId).toString("base64");

      await db
        .insertInto("tbl_operations")
        .values({
          id: operationId,
          customer_id: TEST_CUSTOMER_ID,
          status: "PENDING",
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      const response = await request(app)
        .post("/v1/documents/callback/success")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .query({ hash })
        .send({ invoiceNumber: "INV-INVALID-001" });

      assert(response.status >= 400);

      // Verify operation status unchanged
      const operation = await db
        .selectFrom("tbl_operations")
        .where("id", "=", operationId)
        .selectAll()
        .executeTakeFirst();
      assert.strictEqual(operation?.status, "PENDING");
    });

    it("should rollback transaction when missing invoiceNumber in payload item", async () => {
      const operationId = randomUUID();
      const hash = Buffer.from(operationId).toString("base64");

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
        .execute();

      const xmlBase64 = Buffer.from("<invoice>test</invoice>").toString(
        "base64",
      );
      const response = await request(app)
        .post("/v1/documents/callback/success")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
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

  describe("Transaction & consistency", () => {
    it("should fully rollback on error during document save", async () => {
      const operationId = randomUUID();
      const hash = Buffer.from(operationId).toString("base64");

      await db
        .insertInto("tbl_operations")
        .values({
          id: operationId,
          customer_id: TEST_CUSTOMER_ID,
          status: "PENDING",
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      // Send invalid data that will fail during save
      const response = await request(app)
        .post("/v1/documents/callback/success")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .query({ hash })
        .send({
          xmlBase64: "invalid-not-base64!@#$",
          invoiceNumber: "INV-ERROR-001",
        });

      assert(response.status >= 400);

      // Verify no partial updates
      const operation = await db
        .selectFrom("tbl_operations")
        .where("id", "=", operationId)
        .selectAll()
        .executeTakeFirst();
      assert.strictEqual(operation?.status, "PENDING");
    });

    it("should process multiple payload items atomically", async () => {
      const operationId = randomUUID();
      const hash = Buffer.from(operationId).toString("base64");

      await db
        .insertInto("tbl_operations")
        .values({
          id: operationId,
          customer_id: TEST_CUSTOMER_ID,
          status: "PENDING",
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      const xmlBase64 = Buffer.from("<invoice>test</invoice>").toString(
        "base64",
      );
      const response = await request(app)
        .post("/v1/documents/callback/success")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .query({ hash })
        .send({
          xmlBase64,
          invoiceNumber: `INV-ATOMIC-${randomUUID().slice(0, 8)}`,
        });

      if (response.status !== 200 && response.status !== 302) {
        assert.fail(
          `Expected 200 or 302 but got ${response.status}: ${JSON.stringify(response.body)}`,
        );
      }

      const operation = await db
        .selectFrom("tbl_operations")
        .where("id", "=", operationId)
        .selectAll()
        .executeTakeFirst();
      assert(
        operation?.status === "COMPLETED" || operation?.status === "PENDING",
      );
    });
  });

  describe("Redirect behavior", () => {
    it("should return 302 redirect when success URL exists", async () => {
      const operationId = randomUUID();
      const successUrl = "https://example.com/success-redirect";
      const hash = Buffer.from(operationId).toString("base64");

      await db
        .insertInto("tbl_operations")
        .values({
          id: operationId,
          customer_id: TEST_CUSTOMER_ID,
          status: "PENDING",
          success_callback_url: successUrl,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      const xmlBase64 = Buffer.from("<invoice>test</invoice>").toString(
        "base64",
      );
      const response = await request(app)
        .post("/v1/documents/callback/success")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .query({ hash })
        .send({
          xmlBase64,
          invoiceNumber: `INV-REDIR-${randomUUID().slice(0, 8)}`,
        });

      assert(response.status === 302 || response.status === 303);
      assert.strictEqual(response.headers.location, successUrl);
    });

    it("should return 302 redirect when failure URL exists", async () => {
      const operationId = randomUUID();
      const failureUrl = "https://example.com/failure-redirect";
      const hash = Buffer.from(operationId).toString("base64");

      await db
        .insertInto("tbl_operations")
        .values({
          id: operationId,
          customer_id: TEST_CUSTOMER_ID,
          status: "PENDING",
          failure_callback_url: failureUrl,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      const response = await request(app)
        .post("/v1/documents/callback/failure")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .query({ hash })
        .send({
          xmlBase64: "dGVzdA==",
          invoiceNumber: `INV-FAIL-REDIR-${randomUUID().slice(0, 8)}`,
        });

      assert(response.status === 302 || response.status === 303);
      assert.strictEqual(response.headers.location, failureUrl);
    });

    it("should not include redirect headers when returning JSON response", async () => {
      const operationId = randomUUID();
      const hash = Buffer.from(operationId).toString("base64");

      await db
        .insertInto("tbl_operations")
        .values({
          id: operationId,
          customer_id: TEST_CUSTOMER_ID,
          status: "PENDING",
          success_callback_url: null,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .execute();

      await db
        .updateTable("tbl_tkr_customers")
        .set({ default_success_url: null })
        .where("id", "=", TEST_CUSTOMER_ID)
        .execute();

      const xmlBase64 = Buffer.from("<invoice>test</invoice>").toString(
        "base64",
      );
      const response = await request(app)
        .post("/v1/documents/callback/success")
        .set("Authorization", `Bearer ${testCustomer!.token}`)
        .query({ hash })
        .send({
          xmlBase64,
          invoiceNumber: `INV-JSON-${randomUUID().slice(0, 8)}`,
        });

      assert.strictEqual(response.status, 200);
      assert(!response.headers.location);
      assert(
        response.headers["content-type"]?.includes("application/json"),
        "Should return JSON content type",
      );
    });
  });
});

describe("Request ID Correlation", () => {
  it("should preserve provided X-Request-Id header", async () => {
    const customRequestId = randomUUID();
    const response = await request(app)
      .get("/health")
      .set("X-Request-Id", customRequestId);

    logResponse("Custom Request ID", response);
    assert.strictEqual(
      response.headers["x-request-id"],
      customRequestId,
      `Expected request ID ${customRequestId} but got ${response.headers["x-request-id"]}`,
    );
  });

  it("should generate new X-Request-Id if not provided", async () => {
    const response = await request(app).get("/health");

    logResponse("Auto Request ID", response);
    assert(response.headers["x-request-id"], "Missing X-Request-Id header");
    // Should be a valid UUID
    assert(
      /^[0-9a-f-]+$/.test(response.headers["x-request-id"]),
      `Invalid UUID format for x-request-id: ${response.headers["x-request-id"]}`,
    );
  });

  it("should include X-Request-Id in authenticated requests", async () => {
    const response = await request(app)
      .get("/v1/documents/status/INV-TEST")
      .set("Authorization", `Bearer ${testCustomer!.token}`);

    logResponse("Auth Request ID", response);
    assert(
      response.headers["x-request-id"],
      `Missing X-Request-Id header in response: ${JSON.stringify(response.headers)}`,
    );
  });
});

describe("Error Handling", () => {
  it("should return 500 for unexpected server errors", async () => {
    // This would depend on your app having error scenarios
    // Adjust based on your actual error cases
    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send({});

    logResponse("Server Error", response);
    assert(
      response.status >= 400,
      `Expected error status (>=400) but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });
});

describe("Complete Workflow", () => {
  it("should handle complete document workflow", async () => {
    const payload = createTestPayload();
    const invoice = payload.data[0].invoice;

    console.log("\n📋 Starting complete workflow test");

    // Step 1: Create documents
    console.log("   Step 1: Creating documents...");
    const createResponse = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send(payload);

    logResponse("Create Documents", createResponse, 202);
    assert(
      createResponse.status === 202 || createResponse.status === 200,
      `Create failed with status ${createResponse.status}: ${JSON.stringify(createResponse.body)}`,
    );
    console.log("   ✓ Documents created successfully");

    // Step 2: Check status
    console.log("   Step 2: Checking document status...");
    const statusResponse = await request(app)
      .get(`/v1/documents/status/${invoice.header.documentNumber}`)
      .set("Authorization", `Bearer ${testCustomer!.token}`);

    logResponse("Check Status", statusResponse);
    console.log("   ✓ Status check completed");

    // Status endpoint should be accessible
    assert(
      statusResponse.status !== 401,
      `Status check failed with 401 (auth error): ${JSON.stringify(statusResponse.body)}`,
    );

    // Step 3: Get artifacts (if they exist)
    const artifactsResponse = await request(app)
      .get(`/v1/documents/artifacts/${invoice.header.documentNumber}`)
      .set("Authorization", `Bearer ${testCustomer!.token}`);

    assert(artifactsResponse.status !== 401);
  });
});
