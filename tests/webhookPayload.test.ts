import { describe, expect, test } from "vitest";

import {
  callbackForEvent,
  normalizeWebhookPayload,
  redactedWebhookConfig,
} from "../src/component/lib/webhookPayload.js";

describe("normalizeWebhookPayload", () => {
  test("normalizes SMS message events into a stable callback envelope", () => {
    const normalized = normalizeWebhookPayload({
      event: "agent.message",
      channel: "sms",
      timestamp: "2025-01-15T12:00:00Z",
      agentId: "agt_abc123",
      data: {
        conversationId: "conv_def456",
        numberId: "num_xyz789",
        from: "+15559876543",
        to: "+15551234567",
        message: "Hi",
        direction: "inbound",
        receivedAt: "2025-01-15T12:00:00Z",
      },
      conversationState: { topic: "support" },
      recentHistory: [],
    });

    expect(normalized).toMatchObject({
      event: "agent.message",
      channel: "sms",
      agentId: "agt_abc123",
      callback: "onMessage",
      text: "Hi",
      conversationId: "conv_def456",
      numberId: "num_xyz789",
    });
  });

  test("routes voice message events to the voice callback and transcript text", () => {
    const normalized = normalizeWebhookPayload({
      event: "agent.message",
      channel: "voice",
      timestamp: "2025-01-15T14:00:05Z",
      agentId: "agt_abc123",
      data: {
        callId: "call_abc123",
        numberId: "num_xyz789",
        from: "+15559876543",
        to: "+15551234567",
        status: "in-progress",
        transcript: "I need help",
        confidence: 0.95,
        direction: "inbound",
      },
      conversationState: null,
      recentHistory: [],
    });

    expect(normalized.callback).toBe("onVoiceMessage");
    expect(normalized.text).toBe("I need help");
    expect(normalized.callId).toBe("call_abc123");
  });

  test("routes call-ended and reaction events to their own callbacks", () => {
    expect(callbackForEvent("agent.call_ended", "voice")).toBe("onCallEnded");
    expect(callbackForEvent("agent.reaction", "imessage")).toBe("onReaction");
  });
});

describe("redactedWebhookConfig", () => {
  test("removes webhook secrets from returned configuration objects", () => {
    expect(
      redactedWebhookConfig({
        id: "wh_123",
        url: "https://example.com/webhook",
        secret: "whsec_sensitive",
        status: "active",
      }),
    ).toEqual({
      id: "wh_123",
      url: "https://example.com/webhook",
      status: "active",
      hasSecret: true,
    });
  });
});
