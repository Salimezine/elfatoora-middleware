import assert from "assert";
import type { Express } from "express";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import {
  cleanupTestData,
  createTestPayload,
  initializeApp,
  setupTestCustomer,
  TestCustomer,
} from "../helpers/e2e.helpers.js";

let testCustomer: TestCustomer | null = null,
  app: Express;

// Test Suite
describe("Authentication", () => {
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
