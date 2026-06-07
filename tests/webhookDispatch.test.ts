import { describe, expect, test } from "vitest";

import {
  nextWebhookRetryDelayMs,
  shouldRetryWebhookDispatch,
} from "../src/component/lib/webhookDispatch.js";

describe("webhook dispatch reliability helpers", () => {
  test("uses exponential backoff for callback retries", () => {
    expect(nextWebhookRetryDelayMs(1)).toBe(1000);
    expect(nextWebhookRetryDelayMs(2)).toBe(2000);
    expect(nextWebhookRetryDelayMs(5)).toBe(16000);
  });

  test("moves deliveries to the dead-letter path after max attempts", () => {
    expect(shouldRetryWebhookDispatch({ attempt: 1, maxAttempts: 3 })).toBe(true);
    expect(shouldRetryWebhookDispatch({ attempt: 3, maxAttempts: 3 })).toBe(false);
  });
});
