import { randomUUID } from "crypto";

// Test data constants
export const TEST_CUSTOMER_ID = randomUUID() as string;
export const TEST_TAX_ID = "1234567AAM000";
export const TEST_TOKEN = "test-token-" + randomUUID();
export const TEST_NGSIGN_TOKEN =
  "eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJraGFycmF0Lm1AdGVrcnUubmV0IiwiYXBpTG9nIjpmYWxzZSwiaWF0IjoxNzY5MDQwNjY0LCJlbWFpbCI6ImtoYXJyYXQubUB0ZWtydS5uZXQifQ.VRfe-gzzmhGD8t40Rrj4-vkoIqAQzX6k-MI4hNM3kIKC1FMg74oIPjdWakUyv-QLTes5oR5fQeXOblL9ucMRvA";
export const TEST_NGSIGN_EMAIL = "kharrat.m@tekru.net";
