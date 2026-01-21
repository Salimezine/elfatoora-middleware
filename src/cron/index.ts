import cron from "node-cron";
import { handleDocumentFromTTN } from "../business-logic/ttn/ttn-consult-doc.worker.js";
import { submitPendingDocumentsToTTN } from "../business-logic/ttn/ttn-submission.worker.js";
import { webhookWorker } from "./webhook-worker.js";

export function initializeCronJobs() {
  // Run TTN submission cron every 5 minutes
  const ttnSubmissionJob = cron.schedule("*/5 * * * *", async () => {
    console.log("[Cron] Starting TTN submission job");
    await submitPendingDocumentsToTTN();
  });

  // Run TTN document handler cron every 10 minutes
  const ttnDocumentHandlerJob = cron.schedule("*/10 * * * *", async () => {
    console.log("[Cron] Starting TTN document handler job");
    await handleDocumentFromTTN();
  });

  // Run webhook worker cron every 10 minutes
  const webhookWorkerJob = cron.schedule("* * * * *", async () => {
    console.log("[Cron] Starting webhook worker job");
    await webhookWorker();
  });

  console.log("[Cron] Initialized cron jobs");

  return {
    ttnSubmissionJob,
    ttnDocumentHandlerJob,
    webhookWorkerJob,
  };
}

export function stopCronJobs(jobs: ReturnType<typeof initializeCronJobs>) {
  jobs.ttnSubmissionJob.stop();
  jobs.ttnDocumentHandlerJob.stop();
  jobs.webhookWorkerJob.stop();
  console.log("[Cron] Stopped all cron jobs");
}
