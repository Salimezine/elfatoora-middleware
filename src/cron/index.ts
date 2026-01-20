import cron from "node-cron";
import { submitPendingDocumentsToTTN } from "./ttn-submission.js";

export function initializeCronJobs() {
  // Run TTN submission cron every 5 minutes
  const ttnSubmissionJob = cron.schedule("*/5 * * * *", async () => {
    console.log("[Cron] Starting TTN submission job");
    await submitPendingDocumentsToTTN();
  });

  console.log("[Cron] Initialized cron jobs");

  return {
    ttnSubmissionJob,
  };
}

export function stopCronJobs(jobs: ReturnType<typeof initializeCronJobs>) {
  jobs.ttnSubmissionJob.stop();
  console.log("[Cron] Stopped all cron jobs");
}
