import { createHmac } from "crypto";
import type { DocumentEventType } from "../../db/schema.js";

/**
 * Maps internal DocumentEventType to external webhook event names.
 * These names are what external systems subscribe to and receive.
 */
export const eventTypeMap: Record<DocumentEventType, string> = {
  RECEIVED: "document.received",
  SIGNING_REQUESTED: "document.signing_requested",
  SIGNED: "document.signed",
  SIGNING_FAILED: "document.signing_failed",
  TTN_SUBMISSION_REQUESTED: "document.ttn.submission_requested",
  TTN_SUBMITTED: "document.ttn.submitted",
  TTN_ACCEPTED: "document.ttn.accepted",
  TTN_REJECTED: "document.ttn.rejected",
  COMPLETED: "document.completed",
  FAILED: "document.failed",
  CANCELLED: "document.cancelled",
  RETRIED: "document.retried",
  STATUS_CHANGED: "document.status_changed",
};

/**
 * Generates HMAC SHA-256 signature for webhook requests.
 * Format: t=<timestamp>,v1=<signature>
 *
 * @param secret The webhook secret
 * @param body Raw request body (JSON string)
 * @returns Signature header value
 */
export function generateWebhookSignature(secret: string, body: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signatureBase = `${timestamp}.${body}`;

  const signature = createHmac("sha256", secret)
    .update(signatureBase)
    .digest("hex");

  return `t=${timestamp},v1=${signature}`;
}

/**
 * Checks if a webhook should receive an event based on its subscription.
 * Empty events array means subscribe to all events.
 */
export function shouldDeliverEvent(
  subscribedEvents: string[],
  eventName: string,
): boolean {
  if (subscribedEvents.length === 0) {
    return true;
  }
  return subscribedEvents.includes(eventName);
}

/**
 * Calculates next retry time based on attempt number using exponential backoff.
 * Retry schedule:
 * - 0→1: Immediate (0 seconds)
 * - 1→2: +1 minute
 * - 2→3: +5 minutes
 * - 3→4: +30 minutes
 * - 4→5: +2 hours
 * - 5+: FAILED (no further retries)
 */
export function getNextRetryTime(attempts: number): Date | null {
  const retryScheduleMinutes = [0, 1, 5, 30, 120];

  if (attempts >= retryScheduleMinutes.length) {
    // Max retries exceeded
    return null;
  }

  const delayMs = (retryScheduleMinutes[attempts] || 0) * 60 * 1000;
  return new Date(Date.now() + delayMs);
}

/**
 * Calculates payload hash for idempotency and verification.
 * Uses SHA-256 of JSON payload.
 */
export function calculatePayloadHash(payload: unknown): string {
  const jsonString = JSON.stringify(payload);
  return createHmac("sha256", "hash").update(jsonString).digest("hex");
}
