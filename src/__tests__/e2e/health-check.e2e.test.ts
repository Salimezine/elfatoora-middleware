import assert from "assert";
import type { Express } from "express";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { initializeApp } from "../helpers/e2e.helpers.js";

let app: Express;

// Test Suite
describe("GET /health - Health Check", () => {
  before(async () => {
    // Initialize the app
    app = await initializeApp();
    assert(app, "Failed to initialize app");
  });

  after(() => {});

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
