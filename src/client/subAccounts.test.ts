import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

let AgentPhone: typeof import("./index.js").AgentPhone;

const componentApi = {
  subAccounts: {
    create: "subAccounts:create",
    remove: "subAccounts:remove",
  },
  messages: { send: "messages:send" },
  request: { request: "request:request" },
} as never;

beforeAll(async () => {
  vi.stubGlobal("Convex", {});
  ({ AgentPhone } = await import("./index.js"));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function master() {
  return new AgentPhone(componentApi, {
    scope: "master",
    AGENTPHONE_API_KEY: "test_token",
    defaultAgentId: "agt_master",
    defaultNumberId: "num_master",
  });
}

function actionContext<T>(result: T) {
  return {
    runAction: vi.fn(async () => result),
    runMutation: vi.fn(async () => result),
    runQuery: vi.fn(async () => result),
  };
}

describe("AgentPhone sub-accounts", () => {
  test("creates a sub-account against the master account", async () => {
    const agentphone = master();
    const ctx = actionContext({ subAccountId: "sub_123", status: "active" });

    await agentphone.createSubAccount(ctx as never, {
      name: "Acme",
      key: "tenant_1",
    });

    expect(ctx.runAction).toHaveBeenCalledWith("subAccounts:create", {
      token: "test_token",
      scope: "master",
      name: "Acme",
      key: "tenant_1",
      baseUrl: undefined,
    });
  });

  test("binds a derived client to the sub-account and its own scope", async () => {
    const agentphone = master();

    const tenant = agentphone.forSubAccount("sub_123");

    expect(tenant.scope).toBe("master:sub:sub_123");
    expect(tenant.scope).toBe(agentphone.subAccountScope("sub_123"));
    expect(tenant.subAccountId).toBe("sub_123");
    // Master defaults name resources a sub-account cannot see.
    expect(tenant.defaultAgentId).toBeUndefined();
    expect(tenant.defaultNumberId).toBeUndefined();

    const ctx = actionContext({ id: "msg_1" });
    await tenant.sendMessage(ctx as never, {
      toNumber: "+15550000002",
      body: "Hi",
      agentId: "agt_tenant",
    });
    expect(ctx.runAction).toHaveBeenCalledWith(
      "messages:send",
      expect.objectContaining({
        scope: "master:sub:sub_123",
        subAccountId: "sub_123",
        agentId: "agt_tenant",
      }),
    );
  });

  test("accepts a registry entry and explicit overrides", async () => {
    const tenant = master().forSubAccount(
      { subAccountId: "sub_123" },
      { scope: "tenant_1", defaultAgentId: "agt_tenant" },
    );

    expect(tenant.scope).toBe("tenant_1");
    expect(tenant.defaultAgentId).toBe("agt_tenant");
  });

  test("keeps sub-account management on the master client", async () => {
    const tenant = master().forSubAccount("sub_123");
    const ctx = actionContext(null);

    await expect(
      tenant.createSubAccount(ctx as never, { name: "Nested" }),
    ).rejects.toThrow("master-account operation");
    expect(() => tenant.forSubAccount("sub_456")).toThrow(
      "master-account operation",
    );
    await expect(
      tenant.deleteSubAccount(ctx as never, { subAccountId: "sub_123" }),
    ).rejects.toThrow("master-account operation");
    expect(ctx.runAction).not.toHaveBeenCalled();
  });
});
