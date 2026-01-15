import assert from "assert";
import { describe, it } from "node:test";
import { ngSignBase, ngSignUrls, toBase64 } from "../helpers";

describe("ngsign helpers", () => {
  describe("ngSignUrls", () => {
    it("should have sandbox and production URLs", () => {
      assert.strictEqual(ngSignUrls.sandbox, "https://sandbox.ngsign.com");
      assert.strictEqual(ngSignUrls.production, "https://api.ngsign.com");
    });
  });

  describe("ngSignBase", () => {
    it("should return sandbox URL when MODE is TEST", () => {
      assert.strictEqual(
        ngSignBase("/auth"),
        "https://sandbox.ngsign.com/auth"
      );
    });

    it("should return production URL when MODE is PROD", () => {
      assert.strictEqual(
        ngSignBase("/auth", "PROD"),
        "https://api.ngsign.com/auth"
      );
    });

    it("should default to sandbox when MODE is not set", () => {
      assert.strictEqual(
        ngSignBase("/test"),
        "https://sandbox.ngsign.com/test"
      );
    });
  });

  describe("toBase64", () => {
    it("should convert buffer to base64 string", () => {
      const buffer = Buffer.from("hello");
      assert.strictEqual(toBase64(buffer), "aGVsbG8=");
    });

    it("should handle empty buffer", () => {
      const buffer = Buffer.from("");
      assert.strictEqual(toBase64(buffer), "");
    });
  });
});
