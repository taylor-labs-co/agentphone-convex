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
});
