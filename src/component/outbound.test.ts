import { afterEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("durable outbound queue", () => {
  test("does not resend a request when recording its result fails", async () => {
    vi.useFakeTimers();
    vi.stubEnv("AGENTPHONE_API_KEY", "test_token");
    // A response Convex refuses to store, so the post-send write throws.
    const fetchMock = vi.fn(async () =>
      Response.json({ id: "msg_123", $unstorable: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const testConvex = initConvexTest();

    const queued = await testConvex.mutation(api.outbound.enqueueMessage, {
      scope: "default",
      agentId: "agt_123",
      toNumber: "+15550000002",
      body: "Only send me once",
      maxAttempts: 3,
    });
    await testConvex
      .finishAllScheduledFunctions(vi.runAllTimers)
      .catch(() => undefined);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(consoleError).toHaveBeenCalled();
    const status = await testConvex.query(api.outbound.getStatus, {
      scope: "default",
      requestId: queued.requestId,
    });
    expect(status).toMatchObject({ attempts: 1 });
    expect(status?.status).not.toBe("queued");
  });

  test("retries transport failures until maxAttempts is exhausted", async () => {
    vi.useFakeTimers();
    vi.stubEnv("AGENTPHONE_API_KEY", "test_token");
    const fetchMock = vi.fn(async () =>
      Response.json({ error: "upstream unavailable" }, { status: 503 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const testConvex = initConvexTest();

    const queued = await testConvex.mutation(api.outbound.enqueueMessage, {
      scope: "default",
      agentId: "agt_123",
      toNumber: "+15550000002",
      body: "Retry me",
      maxAttempts: 2,
    });
    await testConvex.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const status = await testConvex.query(api.outbound.getStatus, {
      scope: "default",
      requestId: queued.requestId,
    });
    expect(status).toMatchObject({ status: "failed", attempts: 2 });
  });

  test("fails immediately on definitive AgentPhone rejections", async () => {
    vi.useFakeTimers();
    vi.stubEnv("AGENTPHONE_API_KEY", "test_token");
    const testConvex = initConvexTest();

    for (const status of [400, 401, 403, 404, 422]) {
      const fetchMock = vi.fn(async () =>
        Response.json({ error: "rejected" }, { status }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const queued = await testConvex.mutation(api.outbound.enqueueMessage, {
        scope: "default",
        agentId: "agt_123",
        toNumber: "+15550000002",
        body: `Rejected with ${status}`,
        maxAttempts: 3,
      });
      await testConvex.finishAllScheduledFunctions(vi.runAllTimers);

      expect(fetchMock).toHaveBeenCalledOnce();
      expect(
        await testConvex.query(api.outbound.getStatus, {
          scope: "default",
          requestId: queued.requestId,
        }),
      ).toMatchObject({ status: "failed", attempts: 1 });
    }
  });

  test("retries throttled and server-side AgentPhone failures", async () => {
    vi.useFakeTimers();
    vi.stubEnv("AGENTPHONE_API_KEY", "test_token");
    const testConvex = initConvexTest();

    for (const status of [408, 429, 500, 502]) {
      const fetchMock = vi.fn(async () =>
        Response.json({ error: "try again" }, { status }),
      );
      vi.stubGlobal("fetch", fetchMock);

      const queued = await testConvex.mutation(api.outbound.enqueueMessage, {
        scope: "default",
        agentId: "agt_123",
        toNumber: "+15550000002",
        body: `Retryable ${status}`,
        maxAttempts: 2,
      });
      await testConvex.finishAllScheduledFunctions(vi.runAllTimers);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(
        await testConvex.query(api.outbound.getStatus, {
          scope: "default",
          requestId: queued.requestId,
        }),
      ).toMatchObject({ status: "failed", attempts: 2 });
    }
  });

  test("repeats one idempotency key when an ambiguous send is retried", async () => {
    vi.useFakeTimers();
    vi.stubEnv("AGENTPHONE_API_KEY", "test_token");
    // The provider accepts the request but the response never arrives, so the
    // retry cannot tell whether the first attempt took effect.
    const fetchMock = vi
      .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockRejectedValueOnce(new TypeError("network connection lost"))
      .mockResolvedValueOnce(Response.json({ id: "msg_123", status: "sent" }));
    vi.stubGlobal("fetch", fetchMock);
    const testConvex = initConvexTest();

    const queued = await testConvex.mutation(api.outbound.enqueueMessage, {
      scope: "default",
      agentId: "agt_123",
      toNumber: "+15550000002",
      body: "Send me at most once",
      maxAttempts: 2,
    });
    await testConvex.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const keys = fetchMock.mock.calls.map((call) =>
      new Headers(call[1]?.headers).get("Idempotency-Key"),
    );
    expect(keys[0]).toBe(queued.requestId);
    expect(keys[1]).toBe(keys[0]);
    const status = await testConvex.query(api.outbound.getStatus, {
      scope: "default",
      requestId: queued.requestId,
    });
    expect(status).toMatchObject({ status: "sent", attempts: 2 });
  });
});
