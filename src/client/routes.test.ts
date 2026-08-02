import { httpRouter } from "convex/server";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

let AgentPhone: typeof import("./index.js").AgentPhone;

type TestHttpAction = {
  _handler(ctx: unknown, request: Request): Promise<Response>;
};

beforeAll(async () => {
  vi.stubGlobal("Convex", {});
  ({ AgentPhone } = await import("./index.js"));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function registerWebhookRoute(options: {
  scope: string;
  secretOverride?: string;
}) {
  const http = httpRouter();
  const client = new AgentPhone(
    { webhooks: { handle: "webhooks:handle" } } as never,
    {
      scope: options.scope,
      AGENTPHONE_WEBHOOK_SECRET: options.secretOverride,
    },
  );
  client.registerRoutes(http);

  const match = http.lookup("/agentphone/webhook", "POST");
  if (!match) {
    throw new Error("AgentPhone webhook route was not registered");
  }
  return match[0] as unknown as TestHttpAction;
}

function webhookRequest(scope?: string) {
  const url = new URL("https://example.convex.site/agentphone/webhook");
  if (scope !== undefined) {
    url.searchParams.set("scope", scope);
  }
  return new Request(url, {
    method: "POST",
    headers: {
      "X-Webhook-Signature": "signed",
      "X-Webhook-Timestamp": "1234567890",
      "X-Webhook-ID": "delivery_123",
      "X-Webhook-Event": "agent.message",
    },
    body: JSON.stringify({ event: "agent.message", data: {} }),
  });
}

function actionContext() {
  return {
    runAction: vi.fn(async () => ({
      kind: "success" as const,
      duplicate: false,
      callbackResult: null,
    })),
  };
}

describe("AgentPhone.registerRoutes webhook scope binding", () => {
  test("rejects a mismatched query scope when using a secret override", async () => {
    const handler = registerWebhookRoute({
      scope: "tenant-alpha",
      secretOverride: "global-secret",
    });
    const ctx = actionContext();

    const response = await handler._handler(
      ctx,
      webhookRequest("tenant-bravo"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Webhook scope does not match configured scope",
    });
    expect(ctx.runAction).not.toHaveBeenCalled();
  });

  test("binds an override-backed request to the configured scope", async () => {
    const handler = registerWebhookRoute({
      scope: "tenant-alpha",
      secretOverride: "global-secret",
    });
    const ctx = actionContext();

    const response = await handler._handler(
      ctx,
      webhookRequest("tenant-alpha"),
    );

    expect(response.status).toBe(200);
    expect(ctx.runAction).toHaveBeenCalledWith(
      "webhooks:handle",
      expect.objectContaining({
        scope: "tenant-alpha",
        secretOverride: "global-secret",
      }),
    );
  });

  test("preserves per-scope stored-secret routing without an override", async () => {
    const handler = registerWebhookRoute({ scope: "tenant-alpha" });
    const ctx = actionContext();

    const response = await handler._handler(
      ctx,
      webhookRequest("tenant-bravo"),
    );

    expect(response.status).toBe(200);
    expect(ctx.runAction).toHaveBeenCalledWith(
      "webhooks:handle",
      expect.objectContaining({
        scope: "tenant-bravo",
        secretOverride: undefined,
      }),
    );
  });
});
