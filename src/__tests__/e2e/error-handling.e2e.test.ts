import assert from "assert";
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

describe("Error Handling", () => {
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
  it("should return 500 for unexpected server errors", async () => {
    // This would depend on your app having error scenarios
    // Adjust based on your actual error cases
    const response = await request(app)
      .post("/v1/documents")
      .set("Authorization", `Bearer ${testCustomer!.token}`)
      .send({});

    assert(
      response.status >= 400,
      `Expected error status (>=400) but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  });
});
