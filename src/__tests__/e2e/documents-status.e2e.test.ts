import assert from "assert";
import type { Express } from "express";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import {
  cleanupTestData,
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
});
