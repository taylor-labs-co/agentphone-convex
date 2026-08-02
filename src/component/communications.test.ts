import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AgentPhone API actions", () => {
  test("supports provider-free direct test mode", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const testConvex = initConvexTest();

    const result = await testConvex.action(api.messages.send, {
      token: "agentphone_test_mode",
      scope: "default",
      toNumber: "+15550000002",
      body: "Dry run",
      testMode: true,
    });

    expect(result).toMatchObject({
      testMode: true,
      status: "skipped",
      kind: "message",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("sends a typed message request and records the provider result", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({
          id: "msg_123",
          status: "sent",
          channel: "sms",
          from_number: "+15550000001",
          to_number: "+15550000002",
          conversation_id: "conv_123",
          media_urls: [],
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const testConvex = initConvexTest();

    const result = await testConvex.action(api.messages.send, {
      token: "test_token",
      scope: "default",
      agentId: "agt_123",
      toNumber: "+15550000002",
      body: "Your appointment is confirmed.",
    });

    expect(result).toMatchObject({ id: "msg_123", status: "sent" });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(String(requestUrl)).toBe("https://api.agentphone.ai/v1/messages");
    expect(requestInit?.method).toBe("POST");
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      body: "Your appointment is confirmed.",
      agent_id: "agt_123",
      to_number: "+15550000002",
    });

    const events = await testConvex.query(api.events.listBySource, {
      scope: "default",
      source: "api",
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: "message.sent",
      messageId: "msg_123",
      conversationId: "conv_123",
      direction: "outbound",
    });
  });

  test("configures a webhook and keeps the returned secret internal", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json({
          id: "wh_123",
          url: "https://example.convex.site/agentphone/webhook?scope=default",
          secret: "whsec_rotated",
          status: "active",
          contextLimit: 10,
          timeout: 30,
          createdAt: "2026-07-31T12:00:00Z",
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const testConvex = initConvexTest();

    const result = await testConvex.action(api.webhooks.configure, {
      token: "test_token",
      scope: "default",
      url: "https://example.convex.site/agentphone/webhook?scope=default",
      contextLimit: 10,
      timeout: 30,
    });
    const stored = await testConvex.query(internal.webhooks.getConfig, {
      scope: "default",
    });

    expect(result).toMatchObject({ id: "wh_123", secret: "whsec_rotated" });
    expect(stored).toMatchObject({
      scope: "default",
      webhookId: "wh_123",
      secret: "whsec_rotated",
    });
  });
});
