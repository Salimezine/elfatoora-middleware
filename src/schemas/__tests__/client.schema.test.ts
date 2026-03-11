import assert from "assert";
import { describe, it } from "node:test";
import { CreateClientSchema, UpdateClientSchema } from "../client.schema.js";

describe("client.schema", () => {
  describe("CreateClientSchema", () => {
    it("accepts required fields only", () => {
      const result = CreateClientSchema.safeParse({
        name: "Client A",
        taxId: "1234567AAM000",
        api: "Main API token",
      });

      assert.strictEqual(result.success, true);
    });

    it("rejects missing required fields", () => {
      const result = CreateClientSchema.safeParse({
        name: "Client A",
      });

      assert.strictEqual(result.success, false);
    });
  });

  describe("UpdateClientSchema", () => {
    it("accepts update payload", () => {
      const result = UpdateClientSchema.safeParse({
        mode: "prod",
        ngsign_signer_email: "ops@example.com",
      });

      assert.strictEqual(result.success, true);
    });

    it("rejects empty update payload", () => {
      const result = UpdateClientSchema.safeParse({});

      assert.strictEqual(result.success, false);
    });
  });
});
