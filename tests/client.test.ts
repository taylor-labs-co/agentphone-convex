import { describe, expect, test, vi } from "vitest";

import {
  AgentPhone,
  agentValidator,
  callValidator,
  conversationValidator,
  messageValidator,
  numberValidator,
} from "../src/client/index.js";

function fakeComponent() {
  return {
    agents: {
      create: "agents.create",
      list: "agents.list",
    },
    numbers: {
      create: "numbers.create",
    },
    messages: {
      send: "messages.send",
    },
    resources: {
      listMessagesByConversation: "resources.listMessagesByConversation",
      listMessagesByAgent: "resources.listMessagesByAgent",
      listMessagesByNumber: "resources.listMessagesByNumber",
      listMessagesByCounterparty: "resources.listMessagesByCounterparty",
      listCallsByAgent: "resources.listCallsByAgent",
      listCallsByNumber: "resources.listCallsByNumber",
      getLatestConversationState: "resources.getLatestConversationState",
    },
    outbound: {
      enqueueMessage: "outbound.enqueueMessage",
      enqueueOutboundCall: "outbound.enqueueOutboundCall",
      enqueueWebCall: "outbound.enqueueWebCall",
      getStatus: "outbound.getStatus",
      listRequests: "outbound.listRequests",
      cancel: "outbound.cancel",
    },
    sync: {
      syncAgents: "sync.syncAgents",
      syncNumbers: "sync.syncNumbers",
      syncRecentConversations: "sync.syncRecentConversations",
      syncRecentMessages: "sync.syncRecentMessages",
      syncRecentCalls: "sync.syncRecentCalls",
      reconcileWebhookConfig: "sync.reconcileWebhookConfig",
    },
    webhooks: {
      ensureProjectWebhook: "webhooks.ensureProjectWebhook",
      registerCallbacks: "webhooks.registerCallbacks",
      listDeliveries: "webhooks.listDeliveries",
      listFailedDeliveries: "webhooks.listFailedDeliveries",
      replayDelivery: "webhooks.replayDelivery",
      cleanupDeliveries: "webhooks.cleanupDeliveries",
      verifyAndRecord: "webhooks.verifyAndRecord",
    },
  } as any;
}

describe("AgentPhone client helper", () => {
  test("routes SDK-style helper methods to the installed component reference", async () => {
    const ctx = {
      runAction: vi.fn(async () => ({ id: "agt_123" })),
      runQuery: vi.fn(),
      runMutation: vi.fn(),
    };
    const phone = new AgentPhone(fakeComponent());

    const result = await phone.createAgent(ctx as any, { name: "Support Bot" });

    expect(result).toEqual({ id: "agt_123" });
    expect(ctx.runAction).toHaveBeenCalledWith("agents.create", {
      name: "Support Bot",
    });
  });

  test("uses queries for component-owned delivery diagnostics", async () => {
    const ctx = {
      runAction: vi.fn(),
      runQuery: vi.fn(async () => [{ webhookId: "whd_1" }]),
      runMutation: vi.fn(),
    };
    const phone = new AgentPhone(fakeComponent());

    const result = await phone.listWebhookDeliveries(ctx as any, { limit: 10 });

    expect(result).toEqual([{ webhookId: "whd_1" }]);
    expect(ctx.runQuery).toHaveBeenCalledWith("webhooks.listDeliveries", {
      limit: 10,
    });
  });

  test("exports validators for local reactive resource rows", () => {
    expect(agentValidator).toBeDefined();
    expect(numberValidator).toBeDefined();
    expect(conversationValidator).toBeDefined();
    expect(messageValidator).toBeDefined();
    expect(callValidator).toBeDefined();
  });

  test("routes local resource query helpers to component-owned state", async () => {
    const ctx = {
      runAction: vi.fn(),
      runQuery: vi.fn(async () => [{ messageId: "msg_1" }]),
      runMutation: vi.fn(),
    };
    const phone = new AgentPhone(fakeComponent());

    await phone.listMessagesByConversation(ctx as any, {
      conversationId: "conv_1",
      limit: 25,
    });
    await phone.listMessagesByCounterparty(ctx as any, {
      counterparty: "+15551234567",
    });
    await phone.listCallsByAgent(ctx as any, { agentId: "agt_1" });

    expect(ctx.runQuery).toHaveBeenCalledWith(
      "resources.listMessagesByConversation",
      {
        conversationId: "conv_1",
        limit: 25,
      },
    );
    expect(ctx.runQuery).toHaveBeenCalledWith(
      "resources.listMessagesByCounterparty",
      {
        counterparty: "+15551234567",
      },
    );
    expect(ctx.runQuery).toHaveBeenCalledWith("resources.listCallsByAgent", {
      agentId: "agt_1",
    });
  });

  test("supports durable outbound queue helpers", async () => {
    const ctx = {
      runAction: vi.fn(),
      runQuery: vi.fn(async () => ({ status: "queued" })),
      runMutation: vi.fn(async () => ({ requestId: "out_1" })),
    };
    const phone = new AgentPhone(fakeComponent());

    await phone.enqueueMessage(ctx as any, {
      agent_id: "agt_1",
      to_number: "+15551234567",
      body: "Queued",
    });
    await phone.getOutboundStatus(ctx as any, { requestId: "out_1" });
    await phone.cancelOutboundRequest(ctx as any, { requestId: "out_1" });

    expect(ctx.runMutation).toHaveBeenCalledWith("outbound.enqueueMessage", {
      agent_id: "agt_1",
      to_number: "+15551234567",
      body: "Queued",
    });
    expect(ctx.runQuery).toHaveBeenCalledWith("outbound.getStatus", {
      requestId: "out_1",
    });
    expect(ctx.runMutation).toHaveBeenCalledWith("outbound.cancel", {
      requestId: "out_1",
    });
  });

  test("propagates test mode to immediate outbound sends", async () => {
    const ctx = {
      runAction: vi.fn(async () => ({ testMode: true })),
      runQuery: vi.fn(),
      runMutation: vi.fn(),
    };
    const phone = new AgentPhone(fakeComponent(), { testMode: true });

    await phone.sendMessage(ctx as any, {
      agent_id: "agt_1",
      to_number: "+15551234567",
      body: "Dry run",
    });

    expect(ctx.runAction).toHaveBeenCalledWith("messages.send", {
      agent_id: "agt_1",
      to_number: "+15551234567",
      body: "Dry run",
      test_mode: true,
    });
  });

  test("supports webhook setup, replay, cleanup, and sync helpers", async () => {
    const ctx = {
      runAction: vi.fn(async () => ({ ok: true })),
      runQuery: vi.fn(async () => []),
      runMutation: vi.fn(),
    };
    const phone = new AgentPhone(fakeComponent(), { httpPrefix: "/agentphone" });

    await phone.ensureProjectWebhook(ctx as any, {
      eventTypes: ["agent.message"],
    });
    await phone.listFailedWebhookDeliveries(ctx as any, { limit: 5 });
    await phone.replayWebhookDelivery(ctx as any, { webhookId: "wh_1" });
    await phone.cleanupWebhookDeliveries(ctx as any, { olderThanMs: 1000 });
    await phone.syncAgents(ctx as any);
    await phone.reconcileWebhookConfig(ctx as any);

    expect(ctx.runAction).toHaveBeenCalledWith(
      "webhooks.ensureProjectWebhook",
      {
        event_types: ["agent.message"],
        http_prefix: "/agentphone",
      },
    );
    expect(ctx.runQuery).toHaveBeenCalledWith("webhooks.listFailedDeliveries", {
      limit: 5,
    });
    expect(ctx.runAction).toHaveBeenCalledWith("webhooks.replayDelivery", {
      webhookId: "wh_1",
    });
    expect(ctx.runAction).toHaveBeenCalledWith("sync.syncAgents", {});
    expect(ctx.runAction).toHaveBeenCalledWith("sync.reconcileWebhookConfig", {});
  });

  test("registers app-owned webhook routes", () => {
    const routes: Array<Record<string, unknown>> = [];
    const http = {
      route: vi.fn((route: Record<string, unknown>) => routes.push(route)),
    };
    const phone = new AgentPhone(fakeComponent(), { httpPrefix: "/custom" });

    phone.registerRoutes(http as any);

    expect(http.route).toHaveBeenCalledTimes(1);
    expect(routes[0]!).toMatchObject({
      path: "/custom/webhook",
      method: "POST",
    });
    expect(typeof routes[0]!.handler).toBe("function");
  });
});
