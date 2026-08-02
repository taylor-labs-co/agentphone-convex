import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

let AgentPhone: typeof import("./index.js").AgentPhone;

/** The scope configureAgentWebhook binds an agent override to. */
const AGENT_SCOPE = "tenant-alpha:agent:agt_123";

beforeAll(async () => {
  vi.stubGlobal("Convex", {});
  ({ AgentPhone } = await import("./index.js"));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function client() {
  return new AgentPhone(
    {
      webhooks: {
        setSecret: "webhooks:setSecret",
        configure: "webhooks:configure",
      },
    } as never,
    { scope: "tenant-alpha", AGENTPHONE_API_KEY: "test_token" },
  );
}

function mutationContext() {
  return { runMutation: vi.fn(async () => null) };
}

describe("AgentPhone.setWebhookSecret", () => {
  test("stores an agent secret under the agent-specific scope", async () => {
    const agentPhone = client();
    const ctx = mutationContext();

    await agentPhone.setWebhookSecret(ctx as never, {
      secret: "whsec_manual",
      agentId: "agt_123",
    });

    expect(ctx.runMutation).toHaveBeenCalledWith("webhooks:setSecret", {
      scope: AGENT_SCOPE,
      secret: "whsec_manual",
      agentId: "agt_123",
      subAccountId: undefined,
    });
  });

  test("matches the scope configureAgentWebhook registers with AgentPhone", async () => {
    const agentPhone = client();
    const mutationCtx = mutationContext();
    const actionCtx = {
      runAction: vi.fn(async () => ({ id: "wh_123", secret: "whsec_rotated" })),
    };

    await agentPhone.configureAgentWebhook(actionCtx as never, {
      agentId: "agt_123",
      url: "https://example.convex.site/agentphone/webhook",
    });
    await agentPhone.setWebhookSecret(mutationCtx as never, {
      secret: "whsec_manual",
      agentId: "agt_123",
    });

    expect(actionCtx.runAction).toHaveBeenCalledWith(
      "webhooks:configure",
      expect.objectContaining({ scope: AGENT_SCOPE, agentId: "agt_123" }),
    );
    expect(mutationCtx.runMutation).toHaveBeenCalledWith(
      "webhooks:setSecret",
      expect.objectContaining({ scope: AGENT_SCOPE }),
    );
  });

  test("keeps the client scope when no agent is given", async () => {
    const agentPhone = client();
    const ctx = mutationContext();

    await agentPhone.setWebhookSecret(ctx as never, { secret: "whsec_manual" });

    expect(ctx.runMutation).toHaveBeenCalledWith(
      "webhooks:setSecret",
      expect.objectContaining({ scope: "tenant-alpha", agentId: undefined }),
    );
  });

  test("honors an explicit scope override", async () => {
    const agentPhone = client();
    const ctx = mutationContext();

    await agentPhone.setWebhookSecret(ctx as never, {
      secret: "whsec_manual",
      scope: "legacy-scope",
      agentId: "agt_123",
    });

    expect(ctx.runMutation).toHaveBeenCalledWith(
      "webhooks:setSecret",
      expect.objectContaining({ scope: "legacy-scope" }),
    );
  });
});
