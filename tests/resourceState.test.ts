import { describe, expect, test } from "vitest";

import {
  extractAgentPhoneRecords,
  resourceSnapshotsFromWebhook,
} from "../src/component/lib/resourceState.js";

describe("resource state helpers", () => {
  test("extracts array-shaped SDK responses from common provider envelopes", () => {
    expect(extractAgentPhoneRecords({ data: [{ id: "one" }] })).toEqual([
      { id: "one" },
    ]);
    expect(extractAgentPhoneRecords({ agents: [{ agent_id: "agt_1" }] })).toEqual([
      { agent_id: "agt_1" },
    ]);
    expect(extractAgentPhoneRecords([{ id: "direct" }])).toEqual([
      { id: "direct" },
    ]);
  });

  test("builds normalized local resource snapshots from message webhooks", () => {
    const snapshots = resourceSnapshotsFromWebhook({
      webhookId: "wh_1",
      receivedAt: 1800000000000,
      normalized: {
        event: "agent.message",
        channel: "sms",
        callback: "onMessage",
        agentId: "agt_1",
        conversationId: "conv_1",
        numberId: "num_1",
        messageId: "msg_1",
        text: "hello",
        from: "+15550000001",
        to: "+15550000002",
        direction: "inbound",
        timestamp: "2026-01-01T00:00:00.000Z",
        payload: { data: { provider: true } },
      },
      payload: { data: { provider: true } },
    });

    expect(snapshots).toMatchObject({
      agent: { agentId: "agt_1" },
      number: { numberId: "num_1" },
      conversation: {
        conversationId: "conv_1",
        agentId: "agt_1",
        lastMessageText: "hello",
        lastDirection: "inbound",
      },
      message: {
        messageId: "msg_1",
        conversationId: "conv_1",
        counterparty: "+15550000001",
      },
    });
  });
});
