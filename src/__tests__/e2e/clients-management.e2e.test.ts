import assert from "assert";
import type { Express } from "express";
import { after, before, describe, it } from "node:test";
import request from "supertest";
import { db } from "../../db/client.js";
import { initializeApp } from "../helpers/e2e.helpers.js";

const TEST_GLOBAL_API_KEY = "test-global-api-key";
const TEST_TAX_ID = "7654321AAM111";

let app: Express;

describe("Clients Management", () => {
  before(async () => {
    process.env.GLOBAL_API_KEY = TEST_GLOBAL_API_KEY;
    app = await initializeApp();
  });

  after(async () => {
    await db
      .deleteFrom("tbl_tkr_customer_tokens")
      .where("customer_id", "in", (eb) =>
        eb
          .selectFrom("tbl_tkr_customers")
          .select("id")
          .where("tax_id", "=", TEST_TAX_ID),
      )
      .execute();

    await db
      .deleteFrom("tbl_tkr_customers")
      .where("tax_id", "=", TEST_TAX_ID)
      .execute();
  });

  it("rejects requests without global API key", async () => {
    const response = await request(app).post("/v1/clients").send({
      name: "No Key Client",
      taxId: TEST_TAX_ID,
      api: "Main API",
    });

    assert.strictEqual(response.status, 401);
  });

  it("creates, updates, and removes a client", async () => {
    const createResponse = await request(app)
      .post("/v1/clients")
      .set("x-api-key", TEST_GLOBAL_API_KEY)
      .send({
        name: "Managed Client",
        taxId: TEST_TAX_ID,
        api: "Main API",
      });

    assert.strictEqual(
      createResponse.status,
      201,
      `Create failed: ${JSON.stringify(createResponse.body)}`,
    );
    assert.ok(createResponse.body?.token?.value);

    const updateResponse = await request(app)
      .patch(`/v1/clients/${TEST_TAX_ID}`)
      .set("x-api-key", TEST_GLOBAL_API_KEY)
      .send({
        mode: "prod",
        ngsign_token: "updated-ngsign-token",
        ngsign_signer_email: "signer@example.com",
        ttn_login: "ttn-user",
      });

    assert.strictEqual(
      updateResponse.status,
      200,
      `Update failed: ${JSON.stringify(updateResponse.body)}`,
    );
    assert.strictEqual(updateResponse.body?.client?.mode, "prod");

    const deleteResponse = await request(app)
      .delete(`/v1/clients/${TEST_TAX_ID}`)
      .set("x-api-key", TEST_GLOBAL_API_KEY);

    assert.strictEqual(
      deleteResponse.status,
      200,
      `Delete failed: ${JSON.stringify(deleteResponse.body)}`,
    );
  });
});
