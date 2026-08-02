import { describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

describe("reactive resources", () => {
  test("normalizes provider responses and isolates component scopes", async () => {
    const testConvex = initConvexTest();
    await testConvex.mutation(
      internal.resources.upsertConversationsFromResponse,
      {
        scope: "workspace-a",
        response: {
          conversations: [
            {
              id: "conv_123",
              agent_id: "agt_123",
              number_id: "num_123",
              counterparty: "+15550000002",
              updated_at: "2026-08-01T12:00:00Z",
            },
          ],
        },
      },
    );
    await testConvex.mutation(internal.resources.upsertMessagesFromResponse, {
      scope: "workspace-a",
      response: {
        messages: [
          {
            id: "msg_123",
            conversation_id: "conv_123",
            agent_id: "agt_123",
            number_id: "num_123",
            from_number: "+15550000001",
            to_number: "+15550000002",
            direction: "outbound",
            body: "Hello from the mirror",
            created_at: "2026-08-01T12:01:00Z",
          },
        ],
      },
    });
    await testConvex.mutation(internal.resources.upsertCallRecording, {
      scope: "workspace-a",
      callId: "call_123",
      response: { recording_url: "https://example.com/call_123.mp3" },
    });

    const state = await testConvex.query(
      api.resources.getLatestConversationState,
      { scope: "workspace-a", conversationId: "conv_123" },
    );
    expect(state?.conversation).toMatchObject({
      conversationId: "conv_123",
      agentId: "agt_123",
    });
    expect(state?.messages[0]).toMatchObject({
      messageId: "msg_123",
      counterparty: "+15550000002",
      body: "Hello from the mirror",
    });
    expect(
      await testConvex.query(api.resources.getConversation, {
        scope: "workspace-b",
        conversationId: "conv_123",
      }),
    ).toBeNull();
    expect(
      await testConvex.query(api.resources.getCallRecording, {
        scope: "workspace-a",
        callId: "call_123",
      }),
    ).toMatchObject({
      callId: "call_123",
      url: "https://example.com/call_123.mp3",
    });
  });

  test("runs durable outbound requests in test mode with idempotency", async () => {
    vi.useFakeTimers();
    const testConvex = initConvexTest();
    const first = await testConvex.mutation(api.outbound.enqueueMessage, {
      scope: "default",
      agentId: "agt_123",
      toNumber: "+15550000002",
      body: "Queued hello",
      idempotencyKey: "appointment:123",
      testMode: true,
    });
    const duplicate = await testConvex.mutation(api.outbound.enqueueMessage, {
      scope: "default",
      agentId: "agt_123",
      toNumber: "+15550000002",
      body: "Queued hello",
      idempotencyKey: "appointment:123",
      testMode: true,
    });
    expect(duplicate.requestId).toBe(first.requestId);

    await testConvex.finishAllScheduledFunctions(vi.runAllTimers);
    const status = await testConvex.query(api.outbound.getStatus, {
      scope: "default",
      requestId: first.requestId,
    });
    expect(status).toMatchObject({
      kind: "message",
      status: "sent",
      attempts: 1,
      result: { testMode: true, status: "skipped" },
    });
    vi.useRealTimers();
  });
});
