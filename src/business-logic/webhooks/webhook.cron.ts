import { sql } from "kysely";
import { db, tbl } from "../../db/client.js";
import { generateWebhookSignature, getNextRetryTime } from "./helpers.js";

interface WebhookDeliveryWorkerConfig {
  /**
   * Maximum number of deliveries to process per run.
   * Prevents worker from being overwhelmed.
   */
  batchSize: number;

  /**
   * HTTP request timeout in milliseconds.
   * Financial systems should be conservative.
   */
  requestTimeoutMs: number;

  /**
   * Maximum number of concurrent deliveries.
   * Prevents overwhelming external systems or database.
   */
  concurrency: number;
}

const defaultConfig: WebhookDeliveryWorkerConfig = {
  batchSize: 100,
  requestTimeoutMs: 10_000,
  concurrency: 5,
};

interface WebhookDeliveryResult {
  successful: number;
  failed: number;
  retriedForLater: number;
}

/**
 * Webhook Delivery Worker
 *
 * Background process that:
 * 1. Fetches PENDING webhook deliveries
 * 2. Attempts to POST to configured webhook endpoints
 * 3. On success (2xx): marks as DELIVERED
 * 4. On failure: schedules retry with exponential backoff
 * 5. After max retries: marks as FAILED
 *
 * This worker is designed to:
 * - Run periodically (cron job or event-triggered)
 * - Be idempotent (safe to run multiple times concurrently)
 * - Handle external system failures gracefully
 * - Never lose webhook events
 * - Provide observability for delivery status
 */

/**
 * Main worker entry point.
 * Process pending webhook deliveries.
 */
export async function processWebhookDeliveries(
  config: Partial<WebhookDeliveryWorkerConfig> = {},
): Promise<WebhookDeliveryResult> {
  const finalConfig = { ...defaultConfig, ...config };
  const result: WebhookDeliveryResult = {
    successful: 0,
    failed: 0,
    retriedForLater: 0,
  };

  try {
    // Fetch pending webhook deliveries with their endpoints
    const deliveries = await db
      .selectFrom(tbl("webhook_deliveries"))
      .innerJoin(
        tbl("webhook_endpoints"),
        `${tbl("webhook_endpoints")}.id`,
        `${tbl("webhook_deliveries")}.webhook_id`,
      )
      .where(`${tbl("webhook_deliveries")}.status`, "=", "PENDING")
      .where((eb) =>
        eb.or([
          eb(`${tbl("webhook_deliveries")}.next_retry_at`, "is", null),
          eb(
            `${tbl("webhook_deliveries")}.next_retry_at`,
            "<=",
            sql<Date>`now()`,
          ),
        ]),
      )
      .select([
        `${tbl("webhook_deliveries")}.id as deliveryId`,
        `${tbl("webhook_deliveries")}.payload`,
        `${tbl("webhook_deliveries")}.next_retry_at as nextRetryAt`,
        `${tbl("webhook_endpoints")}.url as webhookUrl`,
        `${tbl("webhook_endpoints")}.secret as webhookSecret`,
      ])
      .limit(finalConfig.batchSize)
      .execute();

    if (deliveries.length === 0) {
      return result;
    }

    // Process deliveries with concurrency limit
    const chunks = splitArray(deliveries, finalConfig.concurrency);

    for (const chunk of chunks) {
      const promises = chunk.map((delivery) =>
        processDelivery(delivery, finalConfig),
      );

      const outcomes = await Promise.allSettled(promises);

      for (let i = 0; i < outcomes.length; i++) {
        const outcome = outcomes[i];
        if (outcome && outcome.status === "fulfilled") {
          const success = outcome.value;
          if (success) result.successful += 1;
          else result.retriedForLater += 1;
        } else {
          result.failed += 1;
        }
      }
    }
  } catch (error) {
    console.error("Webhook delivery worker error:", error);
  }

  return result;
}

type ProcessDeliveryDelivery = {
  deliveryId: string;
  webhookUrl: string;
  webhookSecret: string;
  payload: unknown;
};

/**
 * Process a single webhook delivery.
 * Returns true if delivered successfully, false if scheduled for retry.
 * Throws if unrecoverable error.
 */
async function processDelivery(
  delivery: ProcessDeliveryDelivery,
  config: WebhookDeliveryWorkerConfig,
): Promise<boolean> {
  const { deliveryId } = delivery;

  if (!deliveryId) {
    throw new Error("Missing delivery ID");
  }

  const { webhookUrl, webhookSecret, payload } = delivery;

  if (!webhookUrl || !webhookSecret || !payload) {
    throw new Error("Missing webhook configuration or payload");
  }

  try {
    const body = JSON.stringify(payload);
    const signature = generateWebhookSignature(webhookSecret, body);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tekru-Signature": signature,
        "User-Agent": "Tekru-ElfatooraAPI/1.0",
      },
      body,
      signal: AbortSignal.timeout(config.requestTimeoutMs),
    });

    // Success: 2xx status codes
    if (response.ok) {
      await db
        .updateTable(tbl("webhook_deliveries"))
        .set({ status: "DELIVERED", last_attempt_at: new Date() })
        .where("id", "=", deliveryId)
        .execute();
      return true;
    }

    // Client error (4xx): likely misconfiguration, don't retry forever
    if (response.status >= 400 && response.status < 500) {
      const errorText = await response.text();
      await updateDeliveryFailure(
        deliveryId,
        `Client error ${response.status}: ${errorText}`,
      );
      return false;
    }

    // Server error (5xx) or other: retry
    const errorText = await response.text();
    await updateDeliveryFailure(
      deliveryId,
      `HTTP ${response.status}: ${errorText}`,
    );
    return false;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Timeout and network errors should retry
    await updateDeliveryFailure(deliveryId, `Delivery error: ${errorMessage}`);
    return false;
  }
}

/**
 * Mark a delivery as failed and calculate next retry time.
 * After max retries, status becomes FAILED permanently.
 */
async function updateDeliveryFailure(
  deliveryId: string,
  error: string,
): Promise<void> {
  const delivery = await db
    .selectFrom(tbl("webhook_deliveries"))
    .where("id", "=", deliveryId)
    .selectAll()
    .executeTakeFirst();

  if (!delivery) {
    throw new Error(`Delivery not found: ${deliveryId}`);
  }

  const nextAttempt = delivery.attempts + 1;
  const nextRetryTime = getNextRetryTime(nextAttempt);

  if (nextRetryTime === null) {
    // Max retries exceeded
    await db
      .updateTable(tbl("webhook_deliveries"))
      .set({
        status: "FAILED",
        attempts: nextAttempt,
        last_attempt_at: new Date(),
        last_error: error,
      })
      .where("id", "=", deliveryId)
      .execute();
    return;
  }

  // Schedule next retry
  await db
    .updateTable(tbl("webhook_deliveries"))
    .set({
      status: "PENDING",
      attempts: nextAttempt,
      last_attempt_at: new Date(),
      last_error: error,
      next_retry_at: nextRetryTime,
    })
    .where("id", "=", deliveryId)
    .execute();
}

/**
 * Split array into chunks for concurrent processing.
 */
function splitArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
