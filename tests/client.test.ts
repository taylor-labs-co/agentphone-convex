import { describe, expect, test, vi } from "vitest";

import { AgentPhone } from "../src/client/index.js";

function fakeComponent() {
  return {
    agents: {
      create: "agents.create",
      list: "agents.list",
    },
    numbers: {
      create: "numbers.create",
    },
    webhooks: {
      registerCallbacks: "webhooks.registerCallbacks",
      listDeliveries: "webhooks.listDeliveries",
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
});
