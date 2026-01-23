import assert from "assert";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import {
  cleanupTestData,
  initializeApp,
  setupTestCustomer,
  TestCustomer,
} from "../helpers/e2e.helpers.js";

let app: any = null,
  testCustomer: TestCustomer | null = null;

describe("Request ID Correlation", () => {
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

  it("should preserve provided X-Request-Id header", async () => {
    const customRequestId = randomUUID();
    const response = await request(app)
      .get("/health")
      .set("X-Request-Id", customRequestId);

    assert.strictEqual(
      response.headers["x-request-id"],
      customRequestId,
      `Expected request ID ${customRequestId} but got ${response.headers["x-request-id"]}`,
    );
  });

  it("should generate new X-Request-Id if not provided", async () => {
    const response = await request(app).get("/health");

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

    assert(
      response.headers["x-request-id"],
      `Missing X-Request-Id header in response: ${JSON.stringify(response.headers)}`,
    );
  });
});
