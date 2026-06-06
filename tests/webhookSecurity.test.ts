import { describe, expect, test } from "vitest";

import {
  isTimestampWithinTolerance,
  verifyAgentPhoneSignature,
} from "../src/component/lib/webhookSecurity.js";

const encoder = new TextEncoder();

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

describe("verifyAgentPhoneSignature", () => {
  test("accepts a valid sha256 signature for the timestamp and raw body", async () => {
    const body = JSON.stringify({ event: "agent.message", channel: "sms" });
    const timestamp = "1800000000";
    const secret = "whsec_test";
    const digest = await hmac(secret, `${timestamp}.${body}`);

    await expect(
      verifyAgentPhoneSignature({
        rawBody: body,
        signature: `sha256=${digest}`,
        timestamp,
        secret,
        nowSeconds: 1800000120,
      }),
    ).resolves.toBe(true);
  });

  test("rejects signatures outside the replay tolerance", async () => {
    const body = "{}";
    const timestamp = "1800000000";
    const secret = "whsec_test";
    const digest = await hmac(secret, `${timestamp}.${body}`);

    await expect(
      verifyAgentPhoneSignature({
        rawBody: body,
        signature: `sha256=${digest}`,
        timestamp,
        secret,
        nowSeconds: 1800000301,
      }),
    ).resolves.toBe(false);
  });

  test("rejects malformed or incorrect signatures", async () => {
    await expect(
      verifyAgentPhoneSignature({
        rawBody: "{}",
        signature: "sha256=deadbeef",
        timestamp: "1800000000",
        secret: "whsec_test",
        nowSeconds: 1800000000,
      }),
    ).resolves.toBe(false);
  });
});

describe("isTimestampWithinTolerance", () => {
  test("accepts timestamps within five minutes in either direction", () => {
    expect(isTimestampWithinTolerance("1800000000", 1800000299)).toBe(true);
    expect(isTimestampWithinTolerance("1800000000", 1799999701)).toBe(true);
  });

  test("rejects invalid and stale timestamps", () => {
    expect(isTimestampWithinTolerance("not-a-number", 1800000000)).toBe(false);
    expect(isTimestampWithinTolerance("1800000000", 1800000301)).toBe(false);
  });
});
