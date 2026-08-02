import type { UserIdentity } from "convex/server";
import { describe, expect, test, vi } from "vitest";
import {
  DEFAULT_AGENTPHONE_SCOPE_CLAIM,
  requireAgentPhoneScopeAccess,
} from "./auth.js";

const baseIdentity = {
  tokenIdentifier: "https://issuer.example|user_123",
  subject: "user_123",
  issuer: "https://issuer.example",
} satisfies UserIdentity;

function authContext(identity: UserIdentity | null) {
  return {
    auth: {
      getUserIdentity: vi.fn(async () => identity),
    },
  };
}

describe("requireAgentPhoneScopeAccess", () => {
  test("rejects unauthenticated callers", async () => {
    await expect(
      requireAgentPhoneScopeAccess(authContext(null), { scope: "default" }),
    ).rejects.toThrow("Not authenticated");
  });

  test("rejects identities without an explicit matching scope", async () => {
    await expect(
      requireAgentPhoneScopeAccess(authContext(baseIdentity), {
        scope: "default",
      }),
    ).rejects.toThrow("Not authorized");

    await expect(
      requireAgentPhoneScopeAccess(
        authContext({
          ...baseIdentity,
          [DEFAULT_AGENTPHONE_SCOPE_CLAIM]: ["another-workspace"],
        }),
        { scope: "default" },
      ),
    ).rejects.toThrow("Not authorized");
  });

  test("accepts a matching string or array scope claim", async () => {
    const stringIdentity = {
      ...baseIdentity,
      [DEFAULT_AGENTPHONE_SCOPE_CLAIM]: "default",
    };
    const arrayIdentity = {
      ...baseIdentity,
      [DEFAULT_AGENTPHONE_SCOPE_CLAIM]: ["workspace-a", "default"],
    };

    await expect(
      requireAgentPhoneScopeAccess(authContext(stringIdentity), {
        scope: "default",
      }),
    ).resolves.toBe(stringIdentity);
    await expect(
      requireAgentPhoneScopeAccess(authContext(arrayIdentity), {
        scope: "default",
      }),
    ).resolves.toBe(arrayIdentity);
  });

  test("supports an application-specific claim name", async () => {
    const identity = { ...baseIdentity, workspace_ids: ["scope_123"] };

    await expect(
      requireAgentPhoneScopeAccess(authContext(identity), {
        scope: "scope_123",
        claim: "workspace_ids",
      }),
    ).resolves.toBe(identity);
  });
});
