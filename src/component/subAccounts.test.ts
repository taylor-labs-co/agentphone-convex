import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function createResponse(id: string, name: string) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    Response.json({ id, name, createdAt: "2026-07-31T12:00:00Z" }),
  );
}

describe("sub-account provisioning", () => {
  test("creates a sub-account and registers it under the master scope", async () => {
    const fetchMock = createResponse("sub_123", "Acme");
    vi.stubGlobal("fetch", fetchMock);
    const testConvex = initConvexTest();

    const created = await testConvex.action(api.subAccounts.create, {
      token: "test_token",
      scope: "master",
      name: "Acme",
      key: "tenant_1",
    });

    expect(created).toMatchObject({
      scope: "master",
      key: "tenant_1",
      subAccountId: "sub_123",
      name: "Acme",
      status: "active",
    });
    const [requestUrl, requestInit] = fetchMock.mock.calls[0];
    expect(String(requestUrl)).toBe(
      "https://api.agentphone.ai/v1/sub-accounts",
    );
    expect(JSON.parse(String(requestInit?.body))).toEqual({ name: "Acme" });
    // Sub-accounts belong to the master account, so the request must not name one.
    expect(
      new Headers(requestInit?.headers).get("X-Sub-Account-Id"),
    ).toBeNull();

    const events = await testConvex.query(api.events.listBySource, {
      scope: "master",
      source: "api",
    });
    expect(events).toMatchObject([{ eventType: "sub_account.created" }]);
  });

  test("returns the existing sub-account when a key is provisioned again", async () => {
    const fetchMock = createResponse("sub_123", "Acme");
    vi.stubGlobal("fetch", fetchMock);
    const testConvex = initConvexTest();
    const args = {
      token: "test_token",
      scope: "master",
      name: "Acme",
      key: "tenant_1",
    };

    const first = await testConvex.action(api.subAccounts.create, args);
    const second = await testConvex.action(api.subAccounts.create, args);

    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(
      await testConvex.query(api.subAccounts.list, { scope: "master" }),
    ).toHaveLength(1);
  });

  test("refuses to create a second sub-account while a claim is in flight", async () => {
    const fetchMock = createResponse("sub_123", "Acme");
    vi.stubGlobal("fetch", fetchMock);
    const testConvex = initConvexTest();
    await testConvex.mutation(internal.subAccounts.claim, {
      scope: "master",
      name: "Acme",
      key: "tenant_1",
    });

    await expect(
      testConvex.action(api.subAccounts.create, {
        token: "test_token",
        scope: "master",
        name: "Acme",
        key: "tenant_1",
      }),
    ).rejects.toThrow("still provisioning");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("refuses to release a live claim out from under a create", async () => {
    const testConvex = initConvexTest();
    await testConvex.mutation(internal.subAccounts.claim, {
      scope: "master",
      name: "Acme",
      key: "tenant_1",
    });

    await expect(
      testConvex.mutation(api.subAccounts.releaseClaimByKey, {
        scope: "master",
        key: "tenant_1",
      }),
    ).rejects.toThrow("still live");
    expect(
      await testConvex.query(api.subAccounts.get, {
        scope: "master",
        key: "tenant_1",
      }),
    ).toMatchObject({ status: "provisioning" });
  });

  test("demotes an expired provisioning claim instead of deleting it", async () => {
    vi.useFakeTimers();
    const testConvex = initConvexTest();
    await testConvex.mutation(internal.subAccounts.claim, {
      scope: "master",
      name: "Acme",
      key: "tenant_1",
    });
    vi.advanceTimersByTime(10 * 60 * 1000);

    // First release demotes; the key stays reserved for a late finish.
    expect(
      await testConvex.mutation(api.subAccounts.releaseClaimByKey, {
        scope: "master",
        key: "tenant_1",
      }),
    ).toBe(false);
    expect(
      await testConvex.query(api.subAccounts.get, {
        scope: "master",
        key: "tenant_1",
      }),
    ).toMatchObject({
      status: "unresolved",
      error: "Provisioning claim lease expired without a result",
    });

    // A second release without force keeps the originating claim reserved.
    await expect(
      testConvex.mutation(api.subAccounts.releaseClaimByKey, {
        scope: "master",
        key: "tenant_1",
      }),
    ).rejects.toThrow("force: true");
    expect(
      await testConvex.query(api.subAccounts.get, {
        scope: "master",
        key: "tenant_1",
      }),
    ).toMatchObject({ status: "unresolved" });

    // Force is the explicit recovery once the operator knows nothing is in flight.
    expect(
      await testConvex.mutation(api.subAccounts.releaseClaimByKey, {
        scope: "master",
        key: "tenant_1",
        force: true,
      }),
    ).toBe(true);
    expect(
      await testConvex.query(api.subAccounts.get, {
        scope: "master",
        key: "tenant_1",
      }),
    ).toBeNull();
  });

  test("finishes against the originating claim after an expired lease demotion", async () => {
    vi.useFakeTimers();
    const testConvex = initConvexTest();
    // Expiring the lease and asking to release demotes the claim; the create
    // that still holds claimId must bind the tenant when AgentPhone answers.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        vi.advanceTimersByTime(10 * 60 * 1000);
        expect(
          await testConvex.mutation(api.subAccounts.releaseClaimByKey, {
            scope: "master",
            key: "tenant_1",
          }),
        ).toBe(false);
        return Response.json({ id: "sub_123", name: "Acme" });
      }),
    );

    const created = await testConvex.action(api.subAccounts.create, {
      token: "test_token",
      scope: "master",
      name: "Acme",
      key: "tenant_1",
    });
    expect(created).toMatchObject({
      key: "tenant_1",
      subAccountId: "sub_123",
      status: "active",
    });
    expect(
      await testConvex.query(api.subAccounts.list, { scope: "master" }),
    ).toHaveLength(1);
  });

  test("late completion does not consume a replacement claim for the same key", async () => {
    const testConvex = initConvexTest();
    const original = await testConvex.mutation(internal.subAccounts.claim, {
      scope: "master",
      name: "Acme",
      key: "tenant_1",
    });
    if (original.kind !== "claimed") {
      throw new Error("expected a fresh claim");
    }
    // Simulate an operator freeing the key and starting a replacement create.
    await testConvex.mutation(internal.subAccounts.releaseClaim, {
      claimId: original.claimId,
    });
    const replacement = await testConvex.mutation(internal.subAccounts.claim, {
      scope: "master",
      name: "Acme",
      key: "tenant_1",
    });
    if (replacement.kind !== "claimed") {
      throw new Error("expected a replacement claim");
    }

    const lateOriginal = await testConvex.mutation(
      internal.subAccounts.finishClaim,
      {
        scope: "master",
        claimId: original.claimId,
        key: "tenant_1",
        response: { id: "sub_original", name: "Acme" },
      },
    );
    expect(lateOriginal.bound).toBe(false);
    expect(lateOriginal.record).toMatchObject({
      subAccountId: "sub_original",
      status: "active",
    });
    expect(lateOriginal.record.key).toBeUndefined();
    // The replacement claim is still waiting for its own AgentPhone response.
    expect(
      await testConvex.query(api.subAccounts.get, {
        scope: "master",
        key: "tenant_1",
      }),
    ).toMatchObject({
      status: "provisioning",
    });

    const replacementDone = await testConvex.mutation(
      internal.subAccounts.finishClaim,
      {
        scope: "master",
        claimId: replacement.claimId,
        key: "tenant_1",
        response: { id: "sub_replacement", name: "Acme" },
      },
    );
    expect(replacementDone).toMatchObject({
      bound: true,
      record: {
        key: "tenant_1",
        subAccountId: "sub_replacement",
        status: "active",
      },
    });
    expect(
      await testConvex.query(api.subAccounts.list, { scope: "master" }),
    ).toHaveLength(2);
  });

  test("binds a vacant key when a released claim finishes with no replacement", async () => {
    const testConvex = initConvexTest();
    const claimed = await testConvex.mutation(internal.subAccounts.claim, {
      scope: "master",
      name: "Acme",
      key: "tenant_1",
    });
    if (claimed.kind !== "claimed") {
      throw new Error("expected a fresh claim");
    }
    await testConvex.mutation(internal.subAccounts.releaseClaim, {
      claimId: claimed.claimId,
    });

    const finished = await testConvex.mutation(internal.subAccounts.finishClaim, {
      scope: "master",
      claimId: claimed.claimId,
      key: "tenant_1",
      response: { id: "sub_123", name: "Acme" },
    });
    expect(finished).toMatchObject({
      bound: true,
      record: {
        key: "tenant_1",
        subAccountId: "sub_123",
        status: "active",
      },
    });
  });

  test("preserves an adopted tenant binding when a keyless create finishes late", async () => {
    const testConvex = initConvexTest();
    const claimed = await testConvex.mutation(internal.subAccounts.claim, {
      scope: "master",
      name: "Acme",
    });
    if (claimed.kind !== "claimed") {
      throw new Error("expected a fresh claim");
    }
    // The sub-account is adopted under a tenant while the keyless create is
    // still waiting on AgentPhone.
    await testConvex.mutation(api.subAccounts.adopt, {
      scope: "master",
      key: "tenant_1",
      subAccountId: "sub_123",
      name: "Acme",
    });

    const finished = await testConvex.mutation(internal.subAccounts.finishClaim, {
      scope: "master",
      claimId: claimed.claimId,
      response: { id: "sub_123", name: "Acme renamed" },
    });
    expect(finished).toMatchObject({
      bound: true,
      record: {
        key: "tenant_1",
        subAccountId: "sub_123",
        name: "Acme renamed",
        status: "active",
      },
    });
    expect(
      await testConvex.query(api.subAccounts.list, { scope: "master" }),
    ).toHaveLength(1);
    expect(
      await testConvex.query(api.subAccounts.get, {
        scope: "master",
        key: "tenant_1",
      }),
    ).toMatchObject({ subAccountId: "sub_123", key: "tenant_1" });
  });

  test("never reassigns a key or sub-account that is already bound", async () => {
    const testConvex = initConvexTest();
    await testConvex.mutation(api.subAccounts.adopt, {
      scope: "master",
      key: "tenant_1",
      subAccountId: "sub_123",
    });
    await testConvex.mutation(api.subAccounts.adopt, {
      scope: "master",
      key: "tenant_2",
      subAccountId: "sub_456",
    });

    await expect(
      testConvex.mutation(api.subAccounts.adopt, {
        scope: "master",
        key: "tenant_1",
        subAccountId: "sub_456",
      }),
    ).rejects.toThrow("already names sub-account sub_123");
    await expect(
      testConvex.mutation(api.subAccounts.adopt, {
        scope: "master",
        key: "tenant_3",
        subAccountId: "sub_456",
      }),
    ).rejects.toThrow("already belongs to key tenant_2");

    // Both tenants keep the sub-account they started with.
    expect(
      await testConvex.query(api.subAccounts.get, {
        scope: "master",
        key: "tenant_1",
      }),
    ).toMatchObject({ subAccountId: "sub_123" });
    expect(
      await testConvex.query(api.subAccounts.get, {
        scope: "master",
        key: "tenant_2",
      }),
    ).toMatchObject({ subAccountId: "sub_456" });
  });

  test("reports an abandoned claim instead of risking a duplicate", async () => {
    vi.useFakeTimers();
    const fetchMock = createResponse("sub_123", "Acme");
    vi.stubGlobal("fetch", fetchMock);
    const testConvex = initConvexTest();
    await testConvex.mutation(internal.subAccounts.claim, {
      scope: "master",
      name: "Acme",
      key: "tenant_1",
    });
    vi.advanceTimersByTime(10 * 60 * 1000);

    await expect(
      testConvex.action(api.subAccounts.create, {
        token: "test_token",
        scope: "master",
        name: "Acme",
        key: "tenant_1",
      }),
    ).rejects.toThrow("never settled");
    expect(fetchMock).not.toHaveBeenCalled();

    // Recovery: adopt the sub-account AgentPhone may already hold...
    const adopted = await testConvex.mutation(api.subAccounts.adopt, {
      scope: "master",
      key: "tenant_1",
      subAccountId: "sub_123",
      name: "Acme",
    });
    expect(adopted).toMatchObject({
      key: "tenant_1",
      subAccountId: "sub_123",
      status: "active",
    });
    expect(
      await testConvex.query(api.subAccounts.list, { scope: "master" }),
    ).toHaveLength(1);
  });

  test("frees the key when AgentPhone definitively rejects the create", async () => {
    const reject = vi.fn(async () =>
      Response.json({ detail: "invalid" }, { status: 400 }),
    );
    vi.stubGlobal("fetch", reject);
    const testConvex = initConvexTest();
    const args = {
      token: "test_token",
      scope: "master",
      name: "Acme",
      key: "tenant_1",
    };

    await expect(
      testConvex.action(api.subAccounts.create, args),
    ).rejects.toThrow("400");
    expect(
      await testConvex.query(api.subAccounts.get, {
        scope: "master",
        key: "tenant_1",
      }),
    ).toBeNull();

    vi.stubGlobal("fetch", createResponse("sub_123", "Acme"));
    expect(await testConvex.action(api.subAccounts.create, args)).toMatchObject(
      {
        subAccountId: "sub_123",
      },
    );
  });

  test("keeps the claim when a create outcome is unknown, until it is released", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ detail: "boom" }, { status: 500 })),
    );
    const testConvex = initConvexTest();
    const args = {
      token: "test_token",
      scope: "master",
      name: "Acme",
      key: "tenant_1",
    };

    await expect(
      testConvex.action(api.subAccounts.create, args),
    ).rejects.toThrow("500");
    // Nothing is running any more, so the claim is releasable immediately
    // rather than after the lease expires.
    expect(
      await testConvex.query(api.subAccounts.get, {
        scope: "master",
        key: "tenant_1",
      }),
    ).toMatchObject({
      status: "unresolved",
      error: expect.stringContaining("500"),
    });
    await expect(
      testConvex.action(api.subAccounts.create, args),
    ).rejects.toThrow("never settled");

    expect(
      await testConvex.mutation(api.subAccounts.releaseClaimByKey, {
        scope: "master",
        key: "tenant_1",
      }),
    ).toBe(true);
    expect(
      await testConvex.query(api.subAccounts.get, {
        scope: "master",
        key: "tenant_1",
      }),
    ).toBeNull();
  });

  test("syncing merges AgentPhone's list into keyed registry entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          data: [
            { id: "sub_123", name: "Acme renamed" },
            { id: "sub_456", name: "Globex" },
          ],
        }),
      ),
    );
    const testConvex = initConvexTest();
    await testConvex.mutation(api.subAccounts.adopt, {
      scope: "master",
      key: "tenant_1",
      subAccountId: "sub_123",
      name: "Acme",
    });

    const result = await testConvex.action(api.sync.subAccounts, {
      token: "test_token",
      scope: "master",
    });

    expect(result.synced).toBe(2);
    const registry = await testConvex.query(api.subAccounts.list, {
      scope: "master",
    });
    expect(registry).toHaveLength(2);
    expect(
      await testConvex.query(api.subAccounts.get, {
        scope: "master",
        key: "tenant_1",
      }),
    ).toMatchObject({ subAccountId: "sub_123", name: "Acme renamed" });
  });

  test("deleting a sub-account removes its registry entry", async () => {
    vi.stubGlobal("fetch", createResponse("sub_123", "Acme"));
    const testConvex = initConvexTest();
    await testConvex.action(api.subAccounts.create, {
      token: "test_token",
      scope: "master",
      name: "Acme",
      key: "tenant_1",
    });

    await testConvex.action(api.subAccounts.remove, {
      token: "test_token",
      scope: "master",
      subAccountId: "sub_123",
    });

    expect(
      await testConvex.query(api.subAccounts.list, { scope: "master" }),
    ).toEqual([]);
  });
});
