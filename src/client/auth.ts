import type { UserIdentity } from "convex/server";

export const DEFAULT_AGENTPHONE_SCOPE_CLAIM = "agentphone_scopes";

export interface AgentPhoneAuthContext {
  auth: {
    getUserIdentity(): Promise<UserIdentity | null>;
  };
}

export interface AgentPhoneScopeAccessOptions {
  scope: string;
  /** Custom JWT claim containing one scope or an array of scopes. */
  claim?: string;
}

/**
 * Require an authenticated identity with access to an AgentPhone component
 * scope. This helper fails closed when the configured JWT claim is missing or
 * malformed. Apps that store membership in Convex should perform their own
 * indexed membership lookup instead.
 */
export async function requireAgentPhoneScopeAccess(
  ctx: AgentPhoneAuthContext,
  options: AgentPhoneScopeAccessOptions,
): Promise<UserIdentity> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const claim = options.claim ?? DEFAULT_AGENTPHONE_SCOPE_CLAIM;
  const rawScopes = identity[claim];
  const scopes =
    typeof rawScopes === "string"
      ? [rawScopes]
      : Array.isArray(rawScopes) &&
          rawScopes.every((scope): scope is string => typeof scope === "string")
        ? rawScopes
        : [];

  if (!scopes.includes(options.scope)) {
    throw new Error("Not authorized");
  }

  return identity;
}
