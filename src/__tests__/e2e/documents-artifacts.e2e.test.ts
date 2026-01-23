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
  invoiceNumber = "INV-TEST-ARTIFACTS-001";

describe("GET /v1/documents/artifacts/:invoiceNumber - Document Artifacts", () => {
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
      `/v1/documents/artifacts/${invoiceNumber}`,
    );

    assert.strictEqual(
      response.status,
      401,
      `Expected 401 without auth but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });

  it("should return 404 when no artifacts found", async () => {
    const nonExistentInvoice = "INV-NONEXISTENT-999";
    const response = await request(app)
      .get(`/v1/documents/artifacts/${nonExistentInvoice}`)
      .set("Authorization", `Bearer ${testCustomer!.token}`);

    assert.strictEqual(
      response.status,
      404,
      `Expected 404 for non-existent document but got ${response.status}: ${JSON.stringify(response.body)}`,
    );

    assert.strictEqual(
      response.body.code,
      "ARTIFACTS_NOT_FOUND",
      `Expected error code ARTIFACTS_NOT_FOUND but got ${response.body.code}`,
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

  it("should include X-Request-Id in response", async () => {
    const response = await request(app)
      .get(`/v1/documents/artifacts/${invoiceNumber}`)
      .set("Authorization", `Bearer ${testCustomer!.token}`);

    assert(
      response.headers["x-request-id"],
      `Missing X-Request-Id header: ${JSON.stringify(response.headers)}`,
    );
  });

  it("should return artifacts for a document with all fields", async () => {
    const operationId = randomUUID(),
      documentId = randomUUID();

    // Create operation
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
      .execute()
      .catch(console.error);

    // Create document
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
        payload_hash: "test-hash-123",
        status: "TTN_ACCEPTED",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
      .catch(console.error);

    // Create artifacts
    const testTeifXml =
      '<?xml version="1.0" encoding="UTF-8"?><Invoice></Invoice>';
    const testXmlHash = "abc123hash456";
    const testTtnReference = "TTN-REF-789";
    const testQrCodeBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    await db
      .insertInto("tbl_documents_artifacts")
      .values({
        document_id: documentId,
        teif_xml: testTeifXml,
        xml_hash: testXmlHash,
        signer: "test-signer@example.com",
        certificate_sn: "ABC123456",
        certificate_issuer: "Test CA",
        signature_hash: "test-signature-hash",
        signed_at: new Date(),
        generated_at: new Date(),
        ttn_reference: testTtnReference,
        qr_code_base64: testQrCodeBase64,
      })
      .execute()
      .catch(console.error);

    // Get artifacts
    const response = await request(app)
      .get(`/v1/documents/artifacts/${invoiceNumber}`)
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
      response.body.artifacts,
      `Expected artifacts array in response but got ${JSON.stringify(response.body)}`,
    );

    assert(
      Array.isArray(response.body.artifacts),
      `Expected artifacts to be an array but got ${typeof response.body.artifacts}`,
    );

    assert.strictEqual(
      response.body.artifacts.length,
      1,
      `Expected 1 artifact but got ${response.body.artifacts.length}`,
    );

    const artifact = response.body.artifacts[0];

    assert.strictEqual(
      artifact.status,
      "TTN_ACCEPTED",
      `Expected status to be TTN_ACCEPTED but got ${artifact.status}`,
    );

    assert.strictEqual(
      artifact.teif_xml,
      testTeifXml,
      `Expected teif_xml to match but got ${artifact.teif_xml}`,
    );

    assert.strictEqual(
      artifact.xml_hash,
      testXmlHash,
      `Expected xml_hash to match but got ${artifact.xml_hash}`,
    );

    assert.strictEqual(
      artifact.ttn_reference,
      testTtnReference,
      `Expected ttn_reference to match but got ${artifact.ttn_reference}`,
    );

    assert.strictEqual(
      artifact.qr_code_base64,
      testQrCodeBase64,
      `Expected qr_code_base64 to match but got ${artifact.qr_code_base64}`,
    );
  });

  it("should return artifacts for a document without optional fields", async () => {
    const operationId = randomUUID(),
      documentId = randomUUID();

    // Create operation
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
      .execute()
      .catch(console.error);

    // Create document
    const doc = createValidInvoice();
    const minimalInvoiceNumber = doc.header.documentNumber;
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
        payload_hash: "test-hash-minimal",
        status: "RECEIVED",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
      .catch(console.error);

    // Create minimal artifacts (without optional fields)
    const testTeifXml =
      '<?xml version="1.0" encoding="UTF-8"?><Invoice></Invoice>';
    const testXmlHash = "minimal-hash-123";

    await db
      .insertInto("tbl_documents_artifacts")
      .values({
        document_id: documentId,
        teif_xml: testTeifXml,
        xml_hash: testXmlHash,
        signer: "test-signer@example.com",
        certificate_sn: "ABC123456",
        certificate_issuer: "Test CA",
        signature_hash: "test-signature-hash",
        signed_at: new Date(),
        generated_at: new Date(),
        ttn_reference: null,
        qr_code_base64: null,
      })
      .execute()
      .catch(console.error);

    // Get artifacts
    const response = await request(app)
      .get(`/v1/documents/artifacts/${minimalInvoiceNumber}`)
      .set("Authorization", `Bearer ${testCustomer!.token}`);

    assert.strictEqual(
      response.status,
      200,
      `Expected 200 but got ${response.status}: ${JSON.stringify(response.body)}`,
    );

    assert.strictEqual(
      response.body.artifacts.length,
      1,
      `Expected 1 artifact but got ${response.body.artifacts.length}`,
    );

    const artifact = response.body.artifacts[0];

    assert.strictEqual(
      artifact.status,
      "RECEIVED",
      `Expected status to be RECEIVED but got ${artifact.status}`,
    );

    assert.strictEqual(
      artifact.teif_xml,
      testTeifXml,
      `Expected teif_xml to match`,
    );

    assert.strictEqual(
      artifact.xml_hash,
      testXmlHash,
      `Expected xml_hash to match`,
    );

    // Optional fields should be null
    assert.strictEqual(
      artifact.ttn_reference,
      null,
      `Expected ttn_reference to be null but got ${artifact.ttn_reference}`,
    );

    assert.strictEqual(
      artifact.qr_code_base64,
      null,
      `Expected qr_code_base64 to be null but got ${artifact.qr_code_base64}`,
    );
  });

  it("should not return artifacts from other customers", async () => {
    const otherCustomerId = randomUUID();
    const operationId = randomUUID(),
      documentId = randomUUID();

    // Create a customer for the other user first
    await db
      .insertInto("tbl_tkr_customers")
      .values({
        id: otherCustomerId,
        name: "Other Customer",
        tax_id: "9999999ZZZ999",
        mode: "TEST",
        ngsign_token: "other-token",
        ngsign_signer_email: "other@example.com",
        default_success_url: null,
        default_failure_url: null,
        ttn_login: null,
        ttn_password: null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
      .catch(console.error);

    // Create operation for another customer
    await db
      .insertInto("tbl_operations")
      .values({
        id: operationId,
        customer_id: otherCustomerId,
        status: "PENDING",
        failure_callback_url: "",
        success_callback_url: "",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
      .catch(console.error);

    // Create document for other customer
    const doc = createValidInvoice();
    const otherCustomerInvoiceNumber = doc.header.documentNumber;
    await db
      .insertInto("tbl_documents")
      .values({
        id: documentId,
        operation_id: operationId,
        document_number: doc.header.documentNumber,
        seller_tax_id: "9999999ZZZ999",
        currency: doc.totals.totalTTC.currency,
        source_system: "API",
        document_type: doc.header.type,
        issue_date: doc.header.issueDate as unknown as DateOnly,
        total_ht: doc.totals.subtotalHT.amount,
        total_tva: doc.totals.totalTax.amount,
        total_ttc: doc.totals.totalTTC.amount,
        payload: doc,
        payload_hash: "other-customer-hash",
        status: "TTN_ACCEPTED",
        created_at: new Date(),
        updated_at: new Date(),
      })
      .execute()
      .catch(console.error);

    // Create artifacts for other customer
    await db
      .insertInto("tbl_documents_artifacts")
      .values({
        document_id: documentId,
        teif_xml: '<?xml version="1.0" encoding="UTF-8"?><Invoice></Invoice>',
        xml_hash: "other-hash",
        signer: "other-signer@example.com",
        certificate_sn: "XYZ789",
        certificate_issuer: "Other CA",
        signature_hash: "other-signature-hash",
        signed_at: new Date(),
        generated_at: new Date(),
        ttn_reference: "OTHER-TTN",
        qr_code_base64: null,
      })
      .execute()
      .catch(console.error);

    // Try to get artifacts with test customer's token
    const response = await request(app)
      .get(`/v1/documents/artifacts/${otherCustomerInvoiceNumber}`)
      .set("Authorization", `Bearer ${testCustomer!.token}`);

    assert.strictEqual(
      response.status,
      404,
      `Expected 404 when accessing other customer's artifacts but got ${response.status}`,
    );

    assert.strictEqual(
      response.body.code,
      "ARTIFACTS_NOT_FOUND",
      `Expected error code ARTIFACTS_NOT_FOUND but got ${response.body.code}`,
    );
  });
});
