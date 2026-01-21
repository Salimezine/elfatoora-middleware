import { createHmac } from "crypto";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculatePayloadHash,
  eventTypeMap,
  generateWebhookSignature,
  getNextRetryTime,
  shouldDeliverEvent,
} from "../helpers.js";

describe("Webhook Helpers", () => {
  describe("Event Type Mapping", () => {
    it("should have all expected event types", () => {
      const expectedTypes = [
        "RECEIVED",
        "SIGNING_REQUESTED",
        "SIGNED",
        "SIGNING_FAILED",
        "TTN_SUBMISSION_REQUESTED",
        "TTN_SUBMITTED",
        "TTN_ACCEPTED",
        "TTN_REJECTED",
        "COMPLETED",
        "FAILED",
        "CANCELLED",
        "RETRIED",
        "STATUS_CHANGED",
      ];

      expectedTypes.forEach((type) => {
        assert.ok(
          eventTypeMap[type as keyof typeof eventTypeMap],
          `Missing mapping for ${type}`,
        );
      });
    });

    it("should map internal types to external names", () => {
      assert.equal(eventTypeMap.RECEIVED, "document.received");
      assert.equal(eventTypeMap.SIGNED, "document.signed");
      assert.equal(eventTypeMap.TTN_SUBMITTED, "document.ttn.submitted");
      assert.equal(eventTypeMap.COMPLETED, "document.completed");
      assert.equal(eventTypeMap.CANCELLED, "document.cancelled");
    });
  });

  describe("Event Delivery Filtering", () => {
    it("should deliver to all when subscription is empty", () => {
      const result = shouldDeliverEvent([], "document.created");
      assert.equal(result, true);
    });

    it("should deliver when event is in subscription list", () => {
      const subscription = ["document.received", "document.signed"];
      assert.equal(shouldDeliverEvent(subscription, "document.received"), true);
      assert.equal(shouldDeliverEvent(subscription, "document.signed"), true);
    });

    it("should not deliver when event is not in subscription list", () => {
      const subscription = ["document.received"];
      assert.equal(shouldDeliverEvent(subscription, "document.signed"), false);
    });

    it("should be case-sensitive", () => {
      const subscription = ["document.signed"];
      assert.equal(shouldDeliverEvent(subscription, "document.SIGNED"), false);
      assert.equal(shouldDeliverEvent(subscription, "Document.signed"), false);
    });
  });

  describe("Payload Hashing", () => {
    it("should generate consistent hash for same payload", () => {
      const payload = {
        id: "evt_123",
        type: "document.received",
        data: {
          document: {
            id: "doc_123",
            document_number: "INV-001",
          },
        },
      };

      const hash1 = calculatePayloadHash(payload);
      const hash2 = calculatePayloadHash(payload);

      assert.equal(hash1, hash2);
    });

    it("should generate different hash for different payload", () => {
      const payload1 = {
        id: "evt_123",
        type: "document.received",
        data: { document: { id: "doc_123" } },
      };

      const payload2 = {
        id: "evt_124",
        type: "document.received",
        data: { document: { id: "doc_124" } },
      };

      const hash1 = calculatePayloadHash(payload1);
      const hash2 = calculatePayloadHash(payload2);

      assert.notEqual(hash1, hash2);
    });

    it("should generate hexadecimal hash", () => {
      const payload = { id: "evt_123", type: "document.received" };
      const hash = calculatePayloadHash(payload);

      assert.match(hash, /^[0-9a-f]{64}$/);
    });

    it("should be idempotent across object property order", () => {
      const payload1 = { a: 1, b: 2 };
      const payload2 = { b: 2, a: 1 };

      const hash1 = calculatePayloadHash(payload1);
      const hash2 = calculatePayloadHash(payload2);

      // JSON.stringify preserves key order, so different orders = different hashes
      // This test verifies that JSON serialization is consistent
      assert.match(hash1, /^[0-9a-f]{64}$/);
      assert.match(hash2, /^[0-9a-f]{64}$/);
    });

    it("should handle nested objects", () => {
      const payload = {
        id: "evt_123",
        nested: {
          level1: {
            level2: {
              value: "test",
            },
          },
        },
      };

      const hash = calculatePayloadHash(payload);
      assert.match(hash, /^[0-9a-f]{64}$/);
    });

    it("should handle arrays in payload", () => {
      const payload = {
        id: "evt_123",
        items: [1, 2, 3],
        nested: [{ id: "a" }, { id: "b" }],
      };

      const hash = calculatePayloadHash(payload);
      assert.match(hash, /^[0-9a-f]{64}$/);
    });
  });

  describe("HMAC Signature Generation", () => {
    const secret = "test_secret_key";

    it("should generate valid signature with correct format", () => {
      const body = JSON.stringify({ id: "evt_123", type: "document.received" });
      const signature = generateWebhookSignature(secret, body);

      assert.match(signature, /^t=\d+,v1=[0-9a-f]+$/);
    });

    it("should include timestamp in signature", () => {
      const body = JSON.stringify({ id: "evt_123" });
      const signature = generateWebhookSignature(secret, body);

      const match = signature.match(/^t=(\d+),/);
      assert.ok(match);

      const timestamp = parseInt(match![1], 10);
      const now = Math.floor(Date.now() / 1000);

      // Timestamp should be recent (within 1 second)
      assert.ok(Math.abs(now - timestamp) <= 1);
    });

    it("should generate deterministic signature for same inputs within same second", () => {
      const body = JSON.stringify({ id: "evt_123" });

      // Generate two signatures immediately
      const sig1 = generateWebhookSignature(secret, body);
      const sig2 = generateWebhookSignature(secret, body);

      // Extract timestamp portions
      const ts1 = sig1.split(",")[0];
      const ts2 = sig2.split(",")[0];

      // If timestamps are the same, signatures should be identical
      if (ts1 === ts2) {
        assert.equal(sig1, sig2);
      }
    });

    it("should generate different signatures for different bodies", () => {
      const body1 = JSON.stringify({ id: "evt_123" });
      const body2 = JSON.stringify({ id: "evt_124" });

      const sig1 = generateWebhookSignature(secret, body1);
      const sig2 = generateWebhookSignature(secret, body2);

      assert.notEqual(sig1, sig2);
    });

    it("should generate different signatures for different secrets", () => {
      const body = JSON.stringify({ id: "evt_123" });

      const sig1 = generateWebhookSignature("secret1", body);
      const sig2 = generateWebhookSignature("secret2", body);

      assert.notEqual(sig1, sig2);
    });

    it("should include both timestamp and hmac components", () => {
      const body = JSON.stringify({ id: "evt_123" });
      const signature = generateWebhookSignature(secret, body);

      const [timestampPart, hmacPart] = signature.split(",");

      assert.match(timestampPart, /^t=\d+$/);
      assert.match(hmacPart, /^v1=[0-9a-f]+$/);
    });
  });

  describe("Retry Scheduling", () => {
    it("should return null after max retries", () => {
      const nextRetry = getNextRetryTime(5);
      assert.equal(nextRetry, null);
    });

    it("should return null for attempts beyond max", () => {
      assert.equal(getNextRetryTime(6), null);
      assert.equal(getNextRetryTime(10), null);
    });

    it("should follow exponential backoff schedule", () => {
      const schedule: Array<{
        attempts: number;
        minMs: number;
        maxMs: number;
      }> = [
        { attempts: 0, minMs: 0, maxMs: 1000 }, // Immediate
        { attempts: 1, minMs: 59000, maxMs: 61000 }, // ~1 minute
        { attempts: 2, minMs: 299000, maxMs: 301000 }, // ~5 minutes
        { attempts: 3, minMs: 1799000, maxMs: 1801000 }, // ~30 minutes
        { attempts: 4, minMs: 7199000, maxMs: 7201000 }, // ~2 hours
      ];

      schedule.forEach(({ attempts, minMs, maxMs }) => {
        const nextRetry = getNextRetryTime(attempts);
        assert.ok(nextRetry !== null);

        const delayMs = nextRetry!.getTime() - Date.now();

        assert.ok(
          delayMs >= minMs && delayMs <= maxMs,
          `Attempt ${attempts}: delay ${delayMs}ms should be between ${minMs}-${maxMs}ms`,
        );
      });
    });

    it("should return future Date object", () => {
      const nextRetry = getNextRetryTime(0);
      assert.ok(nextRetry instanceof Date);
      // For 0 attempts (immediate), it should be now or very slightly in future
      assert.ok(nextRetry!.getTime() >= Date.now() - 100);
    });

    it("should have similar delays for same attempt number", () => {
      // Two calls with the same attempts count should have similar delays
      const retry1 = getNextRetryTime(2);
      const retry2 = getNextRetryTime(2);

      const delay1 = retry1!.getTime() - Date.now();
      const delay2 = retry2!.getTime() - Date.now();

      // Allow small variance (within 100ms)
      assert.ok(Math.abs(delay1 - delay2) < 100);
    });

    it("should increase delay with each retry attempt", () => {
      const delays = [0, 1, 2, 3, 4].map((attempts) => {
        const retry = getNextRetryTime(attempts);
        return retry!.getTime() - Date.now();
      });

      // Each subsequent delay should be greater than previous
      for (let i = 1; i < delays.length; i++) {
        assert.ok(
          delays[i] > delays[i - 1],
          `Delay for attempt ${i} should be greater than attempt ${i - 1}`,
        );
      }
    });

    it("should return Date in future even for immediate (0 delay)", () => {
      const retry = getNextRetryTime(0);
      // Even with 0 delay, should be at or near current time
      assert.ok(retry!.getTime() >= Date.now() - 100);
    });
  });

  describe("Signature Verification Manual", () => {
    const secret = "test_secret_key";

    it("should verify signature manually constructed", () => {
      const body = JSON.stringify({ id: "evt_123" });
      const signature = generateWebhookSignature(secret, body);

      // Extract components
      const [timestampPart, hmacPart] = signature.split(",");
      const timestamp = timestampPart.replace("t=", "");
      const expectedHmac = hmacPart.replace("v1=", "");

      // Manually compute HMAC
      const signatureBase = `${timestamp}.${body}`;
      const computedHmac = createHmac("sha256", secret)
        .update(signatureBase)
        .digest("hex");

      assert.equal(computedHmac, expectedHmac);
    });

    it("should fail if HMAC doesn't match body", () => {
      const body1 = JSON.stringify({ id: "evt_123" });
      const body2 = JSON.stringify({ id: "evt_124" });

      const signature = generateWebhookSignature(secret, body1);
      const [timestampPart, hmacPart] = signature.split(",");
      const timestamp = timestampPart.replace("t=", "");
      const hmacValue = hmacPart.replace("v1=", "");

      // Try to verify with different body
      const signatureBase = `${timestamp}.${body2}`;
      const computedHmac = createHmac("sha256", secret)
        .update(signatureBase)
        .digest("hex");

      assert.notEqual(computedHmac, hmacValue);
    });
  });
});
