import cron from "node-cron";
import { handleDocumentFromTTN } from "./ttn-consult-doc.js";
import { submitPendingDocumentsToTTN } from "./ttn-submission.js";

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

  console.log("[Cron] Initialized cron jobs");

  return {
    ttnSubmissionJob,
    ttnDocumentHandlerJob,
  };
}

export function stopCronJobs(jobs: ReturnType<typeof initializeCronJobs>) {
  jobs.ttnSubmissionJob.stop();
  jobs.ttnDocumentHandlerJob.stop();
  console.log("[Cron] Stopped all cron jobs");
}
