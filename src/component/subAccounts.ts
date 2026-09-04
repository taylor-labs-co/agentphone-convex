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
 * How long a `provisioning` claim is treated as live. Within the lease the
 * create that took it may still be waiting on AgentPhone, so the claim is
 * neither reclaimed nor released. After the lease lapses a release demotes the
 * claim to `unresolved` instead of deleting it, so a late response can still
 * finish against the same row. A create that ends without learning the outcome
 * marks its claim `unresolved` instead of waiting out the lease.
 */
const CLAIM_LEASE_MS = 5 * 60 * 1000;

/** Marker left when a release demotes an expired provisioning claim. */
const LEASE_EXPIRED_ERROR =
  "Provisioning claim lease expired without a result";

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
    kind: v.literal("unresolved"),
    key: v.string(),
    at: v.number(),
    error: v.optional(v.string()),
  }),
);

/**
 * A finished create, and whether the registry could still bind it to the key
 * that asked for it. An unbound sub-account is recorded rather than lost, but
 * it is not a successful provisioning. Binding recovers from a released claim
 * when the create still knows the tenant key.
 */
const finishResultValidator = v.object({
  bound: v.boolean(),
  record: provisionedSubAccountValidator,
});

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
    if (claim.kind === "unresolved") {
      throw new Error(
        `A createSubAccount call for key ${claim.key} never settled (last update ${new Date(
          claim.at,
        ).toISOString()}${claim.error ? `: ${claim.error}` : ""}), so AgentPhone may already hold a sub-account for it. Run syncSubAccounts, then either adoptSubAccount to bind the existing sub-account to this key or releaseSubAccountClaim to provision a new one.`,
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
      // A definitive rejection created nothing, so the key is free again. Any
      // other failure leaves the outcome unknown: hand the claim over for
      // explicit recovery rather than letting a retry risk a second account.
      if (createDefinitelyFailed(error)) {
        await ctx.runMutation(internal.subAccounts.releaseClaim, {
          claimId: claim.claimId,
        });
      } else {
        await ctx.runMutation(internal.subAccounts.markUnresolved, {
          claimId: claim.claimId,
          error: errorMessage(error),
        });
      }
      throw error;
    }

    const finished: Infer<typeof finishResultValidator> = await ctx.runMutation(
      internal.subAccounts.finishClaim,
      {
        scope: args.scope,
        claimId: claim.claimId,
        response,
        // Pass the key so a late AgentPhone response can still bind the tenant
        // if the claim row was released after its lease lapsed mid-request.
        ...(args.key && { key: args.key }),
      },
    );
    await recordEventBestEffort(
      ctx,
      args.scope,
      "sub_account.created",
      response,
    );
    if (!finished.bound) {
      throw new Error(
        `AgentPhone created sub-account ${finished.record.subAccountId} but nothing binds it to key ${args.key}. It is recorded without a key: bind it with adoptSubAccount or delete it with deleteSubAccount.`,
      );
    }
    return finished.record;
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
 * Drop an unsettled provisioning claim so the key can be provisioned again.
 * Live claims are refused so a release cannot pull the ledger out from under a
 * create that is still waiting on AgentPhone. After the lease lapses a
 * `provisioning` claim is demoted to `unresolved` and this returns `false`, so
 * a late AgentPhone response can still finish against the same claim row.
 * Lease-demoted claims stay reserved until the create finishes, is adopted, or
 * an explicit `force` release confirms nothing is still in flight. Active
 * entries are never released — delete those with `remove`.
 */
export const releaseClaimByKey = mutation({
  args: {
    scope: v.string(),
    key: v.string(),
    force: v.optional(v.boolean()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await findByKey(ctx, args.scope, args.key);
    if (!row || row.status === "active") {
      return false;
    }
    if (row.status === "provisioning") {
      const remainingMs = row.updatedAt + CLAIM_LEASE_MS - Date.now();
      if (remainingMs > 0) {
        throw new Error(
          `The provisioning claim for key ${args.key} is still live: a createSubAccount call may be waiting on AgentPhone. It becomes releasable in ${Math.ceil(remainingMs / 1000)}s if that call never reports back.`,
        );
      }
      // Demote rather than delete: the originating create may still be awaiting
      // AgentPhone and needs this claimId to bind the tenant when it returns.
      // Return false (key not freed) — throwing would roll the demotion back.
      await ctx.db.patch("subAccounts", row._id, {
        status: "unresolved",
        error: row.error ?? LEASE_EXPIRED_ERROR,
        updatedAt: Date.now(),
      });
      return false;
    }
    // An unresolved claim demoted after lease expiry may still have a create
    // waiting on AgentPhone. Keep it reserved unless the caller explicitly
    // forces release after confirming the outcome.
    if (row.error === LEASE_EXPIRED_ERROR && !args.force) {
      throw new Error(
        `The claim for key ${args.key} was demoted after its lease expired and a createSubAccount call may still be waiting on AgentPhone. Wait for that call to finish, adoptSubAccount if AgentPhone already created one, or pass force: true only if you are sure nothing is still in flight.`,
      );
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
      const live =
        existing.status === "provisioning" &&
        Date.now() - existing.updatedAt < CLAIM_LEASE_MS;
      return live
        ? { kind: "in_flight" as const, key: args.key! }
        : {
            kind: "unresolved" as const,
            key: args.key!,
            at: existing.updatedAt,
            ...(existing.error && { error: existing.error }),
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
  args: {
    scope: v.string(),
    claimId: v.id("subAccounts"),
    response: v.any(),
    key: v.optional(v.string()),
  },
  returns: finishResultValidator,
  handler: async (ctx, args) => {
    const claimed = await ctx.db.get("subAccounts", args.claimId);
    const payload = asRecord(args.response);
    const subAccountId = providerId(payload, ID_KEYS);
    if (!subAccountId) {
      // Leave the claim in place: the sub-account may exist but cannot be
      // addressed, so recovery has to be explicit rather than another create.
      throw new Error(
        `AgentPhone returned a sub-account without an id: ${JSON.stringify(args.response)}`,
      );
    }
    const name = asString(payload.name) ?? claimed?.name;

    // Completion stays tied to the claim that started it. A released claim can
    // still bind a vacant tenant key, but must not replace a newer claim or
    // binding that now holds that key — that row belongs to a different create.
    if (claimed) {
      const record = await upsertActive(ctx, {
        scope: args.scope,
        subAccountId,
        payload: args.response,
        claimId: args.claimId,
        ...(claimed.key && { key: claimed.key }),
        ...(name && { name }),
      });
      // Keyless creates succeed without a tenant key; keyed ones must keep theirs
      // (including when a mid-flight adopt already attached one).
      return {
        bound: claimed.key === undefined || record.key === claimed.key,
        record,
      };
    }

    const key = args.key;
    if (key) {
      const byKey = await findByKey(ctx, args.scope, key);
      if (byKey) {
        if (byKey.subAccountId === subAccountId && byKey.status === "active") {
          return { bound: byKey.key === key, record: asProvisioned(byKey) };
        }
        const record = await upsertActive(ctx, {
          scope: args.scope,
          subAccountId,
          payload: args.response,
          ...(name && { name }),
        });
        return { bound: false, record };
      }
    }

    const record = await upsertActive(ctx, {
      scope: args.scope,
      subAccountId,
      payload: args.response,
      ...(key && { key }),
      ...(name && { name }),
    });
    return {
      bound: key !== undefined && record.key === key,
      record,
    };
  },
});

export const releaseClaim = internalMutation({
  args: { claimId: v.id("subAccounts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("subAccounts", args.claimId);
    if (row && row.status !== "active") {
      await ctx.db.delete("subAccounts", args.claimId);
    }
    return null;
  },
});

/**
 * Hand a claim over for explicit recovery. The create that took it could not
 * tell whether AgentPhone made the sub-account, so the key stays reserved but
 * is no longer treated as live.
 */
export const markUnresolved = internalMutation({
  args: { claimId: v.id("subAccounts"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("subAccounts", args.claimId);
    if (row?.status === "provisioning") {
      await ctx.db.patch("subAccounts", args.claimId, {
        status: "unresolved",
        error: args.error,
        updatedAt: Date.now(),
      });
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
 * claim that started it, then its tenant key, then its AgentPhone id — except
 * a keyless claim never displaces an already-keyed active binding for that id.
 *
 * A key and a sub-account id each name at most one entry in a scope, and this
 * never rewrites a binding that already exists: an entry still waiting for its
 * id absorbs one, but reassigning a key or a sub-account that is already spoken
 * for is refused rather than merged. Otherwise one tenant could take over
 * another's sub-account and leave that tenant unmapped — free to provision a
 * second provider account.
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
  // A late keyless finish must not delete a tenant binding that adopted this
  // sub-account while the claim was in flight — keep the keyed row and drop
  // the claim instead.
  const target =
    claimed &&
    claimed.key === undefined &&
    args.key === undefined &&
    byId?.key !== undefined &&
    byId.status === "active"
      ? byId
      : (claimed ?? byKey ?? byId);

  if (target?.subAccountId && target.subAccountId !== args.subAccountId) {
    throw new Error(
      `Key ${target.key} in scope ${args.scope} already names sub-account ${target.subAccountId}. Delete that sub-account before binding the key to ${args.subAccountId}.`,
    );
  }
  if (
    args.key !== undefined &&
    byId?.key !== undefined &&
    byId.key !== args.key
  ) {
    throw new Error(
      `Sub-account ${args.subAccountId} in scope ${args.scope} already belongs to key ${byId.key}. Release that entry before binding the sub-account to ${args.key}.`,
    );
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

  // Collapse every other row that described this claim, key, or id into the
  // chosen target so the registry keeps a single entry per sub-account.
  const collapsed = new Set<string>();
  for (const row of [claimed, byKey, byId]) {
    if (!row || row._id === target?._id || collapsed.has(row._id)) {
      continue;
    }
    collapsed.add(row._id);
    await ctx.db.delete("subAccounts", row._id);
  }

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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
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
