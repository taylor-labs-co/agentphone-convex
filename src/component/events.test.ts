import { describe, expect, test } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

const secret = "whsec_test_secret";

describe("webhook events", () => {
  test("verifies, stores, indexes, and deduplicates a delivery", async () => {
    const testConvex = initConvexTest();
    await testConvex.mutation(api.webhooks.setSecret, {
      scope: "default",
      secret,
    });

    const payload = {
      event: "agent.message",
      channel: "sms",
      timestamp: new Date().toISOString(),
      agentId: "agt_123",
      data: {
        conversationId: "conv_123",
        numberId: "num_123",
        from: "+15550000001",
        to: "+15550000002",
        message: "Hello",
        direction: "inbound",
      },
    };
    const rawBody = JSON.stringify(payload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = await sign(rawBody, timestamp, secret);

    const first = await testConvex.action(api.webhooks.handle, {
      scope: "default",
      rawBody,
      signature,
      timestamp,
      deliveryId: "delivery_123",
    });
    const duplicate = await testConvex.action(api.webhooks.handle, {
      scope: "default",
      rawBody,
      signature,
      timestamp,
      deliveryId: "delivery_123",
    });

    expect(first).toMatchObject({ kind: "success", duplicate: false });
    expect(duplicate).toMatchObject({ kind: "success", duplicate: true });

    const events = await testConvex.query(api.events.listByConversation, {
      scope: "default",
      conversationId: "conv_123",
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      deliveryId: "delivery_123",
      eventType: "agent.message",
      channel: "sms",
      agentId: "agt_123",
      numberId: "num_123",
      direction: "inbound",
    });

    const state = await testConvex.query(
      api.resources.getLatestConversationState,
      { scope: "default", conversationId: "conv_123" },
    );
    expect(state?.conversation).toMatchObject({
      conversationId: "conv_123",
      agentId: "agt_123",
      numberId: "num_123",
      counterparty: "+15550000001",
      lastMessageText: "Hello",
    });
    expect(state?.messages).toHaveLength(1);

    const deliveries = await testConvex.query(api.deliveries.list, {
      scope: "default",
    });
    expect(deliveries).toMatchObject([
      { deliveryId: "delivery_123", status: "ignored", attempts: 0 },
    ]);
  });

  test("rejects invalid signatures and stale timestamps", async () => {
    const testConvex = initConvexTest();
    await testConvex.mutation(api.webhooks.setSecret, {
      scope: "default",
      secret,
    });
    const rawBody = JSON.stringify({
      event: "agent.message",
      channel: "sms",
      timestamp: new Date().toISOString(),
      data: {},
    });

    const invalidSignature = await testConvex.action(api.webhooks.handle, {
      scope: "default",
      rawBody,
      signature: "sha256=invalid",
      timestamp: String(Math.floor(Date.now() / 1000)),
      deliveryId: "delivery_invalid",
    });
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 301);
    const stale = await testConvex.action(api.webhooks.handle, {
      scope: "default",
      rawBody,
      signature: await sign(rawBody, staleTimestamp, secret),
      timestamp: staleTimestamp,
      deliveryId: "delivery_stale",
    });

    expect(invalidSignature).toMatchObject({ kind: "error", status: 401 });
    expect(stale).toMatchObject({ kind: "error", status: 401 });
    expect(
      await testConvex.query(api.events.list, { scope: "default" }),
    ).toEqual([]);
  });

  test("bounds event reads", async () => {
    const testConvex = initConvexTest();
    await expect(
      testConvex.query(api.events.list, { scope: "default", limit: 101 }),
    ).rejects.toThrow("limit must be an integer between 1 and 100");
  });
});

async function sign(rawBody: string, timestamp: string, signingSecret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `sha256=${hex}`;
}
