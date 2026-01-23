import assert from "assert";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import {
  cleanupTestData,
  createTestPayload,
  initializeApp,
  setupTestCustomer,
  TestCustomer,
} from "../helpers/e2e.helpers.js";

let app: any = null,
  testCustomer: TestCustomer | null = null;

describe("Complete Workflow", () => {
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
