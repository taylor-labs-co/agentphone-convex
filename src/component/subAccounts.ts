import { v, type Infer } from "convex/values";
import { internal } from "./_generated/api.js";
import type { Doc, Id } from "./_generated/dataModel.js";
import {
  action,
  internalMutation,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server.js";
import { extractAgentPhoneRecords, providerId } from "./lib/resourceState.js";
import { AgentPhoneApiError, agentPhoneRequest } from "./request.js";
import schema from "./schema.js";
import { provisionedSubAccountValidator } from "./validators.js";

export type ProvisionedSubAccount = Infer<
  typeof provisionedSubAccountValidator
>;

/**
 * A provisioning claim whose action died before AgentPhone answered stays
 * claimed for this long. After that the entry is reported as stale rather than
 * retried, because a retry could create a second sub-account for one tenant.
 */
const CLAIM_STALE_MS = 5 * 60 * 1000;

const ID_KEYS = ["id", "subAccountId", "sub_account_id"];

const subAccountValidator = schema.tables.subAccounts.validator;

const claimResultValidator = v.union(
  v.object({
    kind: v.literal("claimed"),
    claimId: v.id("subAccounts"),
  }),
  v.object({
    kind: v.literal("existing"),
    record: provisionedSubAccountValidator,
  }),
  v.object({ kind: v.literal("in_flight"), key: v.string() }),
  v.object({
    kind: v.literal("stale"),
    key: v.string(),
    claimedAt: v.number(),
  }),
);

/**
 * Create a sub-account under the master account. Passing `key` makes the call
 * idempotent for that key: the registry entry is claimed in a transaction
 * before AgentPhone is contacted, so concurrent or retried provisioning of one
 * tenant returns the same sub-account instead of creating another.
 */
export const create = action({
  args: {
    token: v.string(),
    scope: v.string(),
    name: v.string(),
    key: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
  },
  returns: provisionedSubAccountValidator,
  handler: async (ctx, args): Promise<ProvisionedSubAccount> => {
    validateName(args.name);
    const claim: Infer<typeof claimResultValidator> = await ctx.runMutation(
      internal.subAccounts.claim,
      {
        scope: args.scope,
        name: args.name,
        ...(args.key && { key: args.key }),
      },
    );
    if (claim.kind === "existing") {
      return claim.record;
    }
    if (claim.kind === "in_flight") {
      throw new Error(
        `Another createSubAccount call for key ${claim.key} is still provisioning. Retry once it settles.`,
      );
    }
    if (claim.kind === "stale") {
      throw new Error(
        `A createSubAccount call for key ${claim.key} started at ${new Date(
          claim.claimedAt,
        ).toISOString()} never finished, so AgentPhone may already hold a sub-account for it. Run syncSubAccounts, then either adoptSubAccount to bind the existing sub-account to this key or releaseSubAccountClaim to provision a new one.`,
      );
    }

    let response: unknown;
    try {
      response = await agentPhoneRequest({
        token: args.token,
        method: "POST",
        path: "sub-accounts",
        body: { name: args.name },
        idempotencyKey: claim.claimId,
        ...(args.baseUrl && { baseUrl: args.baseUrl }),
      });
    } catch (error) {
      if (createDefinitelyFailed(error)) {
        await ctx.runMutation(internal.subAccounts.releaseClaim, {
          claimId: claim.claimId,
        });
      }
      throw error;
    }

    const record: ProvisionedSubAccount = await ctx.runMutation(
      internal.subAccounts.finishClaim,
      { claimId: claim.claimId, response },
    );
    await recordEventBestEffort(
      ctx,
      args.scope,
      "sub_account.created",
      response,
    );
    return record;
  },
});

/** Rename a sub-account and keep the registry entry in step. */
export const update = action({
  args: {
    token: v.string(),
    scope: v.string(),
    subAccountId: v.string(),
    name: v.string(),
    baseUrl: v.optional(v.string()),
  },
  returns: provisionedSubAccountValidator,
  handler: async (ctx, args): Promise<ProvisionedSubAccount> => {
    validateName(args.name);
    const response = await agentPhoneRequest({
      token: args.token,
      method: "PATCH",
      path: `sub-accounts/${encodeURIComponent(args.subAccountId)}`,
      body: { name: args.name },
      ...(args.baseUrl && { baseUrl: args.baseUrl }),
    });
    return await ctx.runMutation(internal.subAccounts.record, {
      scope: args.scope,
      subAccountId: args.subAccountId,
      name: args.name,
      payload: response,
    });
  },
});

/**
 * Delete a sub-account at AgentPhone and drop its registry entry. Records the
 * component already mirrored under the sub-account's own scope are left alone;
 * the app decides when to remove tenant data.
 */
export const remove = action({
  args: {
    token: v.string(),
    scope: v.string(),
    subAccountId: v.string(),
    baseUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const response = await agentPhoneRequest({
      token: args.token,
      method: "DELETE",
      path: `sub-accounts/${encodeURIComponent(args.subAccountId)}`,
      ...(args.baseUrl && { baseUrl: args.baseUrl }),
    });
    await ctx.runMutation(internal.subAccounts.deleteRecord, {
      scope: args.scope,
      subAccountId: args.subAccountId,
    });
    await recordEventBestEffort(
      ctx,
      args.scope,
      "sub_account.deleted",
      response ?? { id: args.subAccountId },
    );
    return null;
  },
});

/**
 * Bind a sub-account AgentPhone already holds to this scope, optionally under a
 * tenant key. Use it to onboard sub-accounts created before this component, or
 * to recover a claim that never finished.
 */
export const adopt = mutation({
  args: {
    scope: v.string(),
    subAccountId: v.string(),
    key: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  returns: provisionedSubAccountValidator,
  handler: async (ctx, args) => await upsertActive(ctx, args),
});

/**
 * Drop an unfinished provisioning claim so the key can be provisioned again.
 * Active entries are never released; delete those with `remove`.
 */
export const releaseClaimByKey = mutation({
  args: { scope: v.string(), key: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await findByKey(ctx, args.scope, args.key);
    if (!row || row.status !== "provisioning") {
      return false;
    }
    await ctx.db.delete("subAccounts", row._id);
    return true;
  },
});

export const list = query({
  args: { scope: v.string(), limit: v.optional(v.number()) },
  returns: v.array(subAccountValidator),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("subAccounts")
      .withIndex("by_scope_and_sub_account_id", (q) =>
        q.eq("scope", args.scope),
      )
      .take(normalizeLimit(args.limit));
    return rows.map(withoutSystemFields);
  },
});

export const get = query({
  args: {
    scope: v.string(),
    subAccountId: v.optional(v.string()),
    key: v.optional(v.string()),
  },
  returns: v.union(subAccountValidator, v.null()),
  handler: async (ctx, args) => {
    if (Boolean(args.subAccountId) === Boolean(args.key)) {
      throw new Error("Provide exactly one of subAccountId or key");
    }
    const row = args.key
      ? await findByKey(ctx, args.scope, args.key)
      : await findBySubAccountId(ctx, args.scope, args.subAccountId!);
    return row ? withoutSystemFields(row) : null;
  },
});

export const claim = internalMutation({
  args: {
    scope: v.string(),
    name: v.string(),
    key: v.optional(v.string()),
  },
  returns: claimResultValidator,
  handler: async (ctx, args) => {
    const existing = args.key
      ? await findByKey(ctx, args.scope, args.key)
      : null;
    if (existing?.status === "active" && existing.subAccountId) {
      return { kind: "existing" as const, record: asProvisioned(existing) };
    }
    if (existing) {
      const age = Date.now() - existing.updatedAt;
      return age < CLAIM_STALE_MS
        ? { kind: "in_flight" as const, key: args.key! }
        : {
            kind: "stale" as const,
            key: args.key!,
            claimedAt: existing.updatedAt,
          };
    }
    const now = Date.now();
    const claimId = await ctx.db.insert("subAccounts", {
      scope: args.scope,
      name: args.name,
      status: "provisioning",
      payload: {},
      syncedAt: now,
      updatedAt: now,
      ...(args.key && { key: args.key }),
    });
    return { kind: "claimed" as const, claimId };
  },
});

export const finishClaim = internalMutation({
  args: { claimId: v.id("subAccounts"), response: v.any() },
  returns: provisionedSubAccountValidator,
  handler: async (ctx, args) => {
    const claimed = await ctx.db.get("subAccounts", args.claimId);
    if (!claimed) {
      throw new Error(
        "AgentPhone created a sub-account but its provisioning claim is gone",
      );
    }
    const payload = asRecord(args.response);
    const subAccountId = providerId(payload, ID_KEYS);
    if (!subAccountId) {
      // Leave the claim in place: the sub-account may exist but cannot be
      // addressed, so recovery has to be explicit rather than another create.
      throw new Error(
        `AgentPhone returned a sub-account without an id: ${JSON.stringify(args.response)}`,
      );
    }
    const name = asString(payload.name) ?? claimed.name;
    return await upsertActive(ctx, {
      scope: claimed.scope,
      subAccountId,
      payload: args.response,
      claimId: args.claimId,
      ...(claimed.key && { key: claimed.key }),
      ...(name && { name }),
    });
  },
});

export const releaseClaim = internalMutation({
  args: { claimId: v.id("subAccounts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("subAccounts", args.claimId);
    if (row?.status === "provisioning") {
      await ctx.db.delete("subAccounts", args.claimId);
    }
    return null;
  },
});

export const record = internalMutation({
  args: {
    scope: v.string(),
    subAccountId: v.string(),
    key: v.optional(v.string()),
    name: v.optional(v.string()),
    payload: v.optional(v.any()),
  },
  returns: provisionedSubAccountValidator,
  handler: async (ctx, args) => await upsertActive(ctx, args),
});

export const upsertFromResponse = internalMutation({
  args: { scope: v.string(), response: v.any() },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    for (const entry of extractAgentPhoneRecords(args.response)) {
      const subAccountId = providerId(entry, ID_KEYS);
      if (!subAccountId) {
        continue;
      }
      await upsertActive(ctx, {
        scope: args.scope,
        subAccountId,
        payload: entry,
        ...(asString(entry.name) && { name: asString(entry.name) }),
      });
      count += 1;
    }
    return count;
  },
});

export const deleteRecord = internalMutation({
  args: { scope: v.string(), subAccountId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await findBySubAccountId(ctx, args.scope, args.subAccountId);
    if (row) {
      await ctx.db.delete("subAccounts", row._id);
    }
    return null;
  },
});

/**
 * Write the one registry entry that describes a sub-account, preferring the
 * claim that started it, then its tenant key, then its AgentPhone id. Entries
 * that turn out to describe the same sub-account are collapsed so a key and an
 * id can never disagree.
 */
async function upsertActive(
  ctx: MutationCtx,
  args: {
    scope: string;
    subAccountId: string;
    key?: string;
    name?: string;
    payload?: unknown;
    claimId?: Id<"subAccounts">;
  },
): Promise<ProvisionedSubAccount> {
  const claimed = args.claimId
    ? await ctx.db.get("subAccounts", args.claimId)
    : null;
  const byKey = args.key ? await findByKey(ctx, args.scope, args.key) : null;
  const byId = await findBySubAccountId(ctx, args.scope, args.subAccountId);
  const target = claimed ?? byKey ?? byId;
  const duplicates = new Map(
    [byKey, byId]
      .filter((row) => row !== null && row._id !== target?._id)
      .map((row) => [row!._id, row!]),
  );
  for (const duplicate of duplicates.values()) {
    await ctx.db.delete("subAccounts", duplicate._id);
  }

  const now = Date.now();
  const value = stripUndefined({
    scope: args.scope,
    key: args.key ?? target?.key,
    subAccountId: args.subAccountId,
    name: args.name ?? target?.name,
    status: "active" as const,
    payload: args.payload ?? target?.payload ?? {},
    syncedAt: now,
    updatedAt: now,
  });
  if (target) {
    await ctx.db.replace("subAccounts", target._id, value);
  } else {
    await ctx.db.insert("subAccounts", value);
  }
  return value;
}

async function findByKey(ctx: QueryCtx, scope: string, key: string) {
  return await ctx.db
    .query("subAccounts")
    .withIndex("by_scope_and_key", (q) => q.eq("scope", scope).eq("key", key))
    .unique();
}

async function findBySubAccountId(
  ctx: QueryCtx,
  scope: string,
  subAccountId: string,
) {
  return await ctx.db
    .query("subAccounts")
    .withIndex("by_scope_and_sub_account_id", (q) =>
      q.eq("scope", scope).eq("subAccountId", subAccountId),
    )
    .unique();
}

async function recordEventBestEffort(
  ctx: ActionCtx,
  scope: string,
  eventType: string,
  response: unknown,
) {
  try {
    await ctx.runMutation(internal.events.recordApiEvent, {
      scope,
      eventType,
      payload: response,
    });
  } catch (error) {
    console.error(
      `AgentPhone ${eventType} succeeded but event recording failed`,
      error,
    );
  }
}

/**
 * Whether AgentPhone definitely did not create anything. Timeouts, throttling,
 * and server errors leave the outcome unknown, so their claims stay in place
 * until they go stale rather than freeing a key that may already be taken.
 */
function createDefinitelyFailed(error: unknown) {
  return (
    error instanceof AgentPhoneApiError &&
    error.status < 500 &&
    error.status !== 408 &&
    error.status !== 429
  );
}

function validateName(name: string) {
  if (name.trim().length < 1 || name.length > 100) {
    throw new Error("Sub-account name must be between 1 and 100 characters");
  }
}

function asProvisioned(row: Doc<"subAccounts">): ProvisionedSubAccount {
  const { subAccountId, ...rest } = withoutSystemFields(row);
  if (!subAccountId) {
    throw new Error("Sub-account entry is still provisioning");
  }
  return { ...rest, subAccountId, status: "active" };
}

function withoutSystemFields(row: Doc<"subAccounts">) {
  const { _id: _ignoredId, _creationTime: _ignoredTime, ...value } = row;
  return value;
}

function normalizeLimit(value: number | undefined) {
  if (value === undefined) {
    return 50;
  }
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("limit must be an integer between 1 and 100");
  }
  return value;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
