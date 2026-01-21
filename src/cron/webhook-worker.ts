import { processWebhookDeliveries } from "../business-logic/webhooks/webhook.cron.js";

/**
 * Webhook delivery worker configuration.
 * Tune these values based on your infrastructure and webhook volume.
 */
const webhookCronConfig = {
  /** Max deliveries to process per run */
  batchSize: 100,
  /** HTTP request timeout (financial systems should be conservative) */
  requestTimeoutMs: 10_000,
  /** Concurrent HTTP requests (prevent overwhelming external systems) */
  concurrency: 5,
};

export async function webhookWorker() {
  try {
    const startTime = Date.now();
    const result = await processWebhookDeliveries(webhookCronConfig);
    const duration = Date.now() - startTime;

    // Log results
    console.log(
      `Webhook worker completed in ${duration}ms: ` +
        `${result.successful} delivered, ` +
        `${result.retriedForLater} queued for retry, ` +
        `${result.failed} failed`,
    );

    // Alert on high failure rate
    const total = result.successful + result.retriedForLater + result.failed;
    if (total > 0) {
      const failureRate = (result.failed / total) * 100;
      if (failureRate > 10) {
        console.warn(
          `⚠️ High webhook failure rate: ${failureRate.toFixed(1)}%`,
        );
      }
    }
  } catch (error) {
    console.error("Webhook worker error:", error);
  }
}
