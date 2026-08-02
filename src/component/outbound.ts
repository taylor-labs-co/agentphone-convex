import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import {
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server.js";
import type { MutationCtx } from "./_generated/server.js";
import schema from "./schema.js";
import { AgentPhoneApiError, agentPhoneRequest } from "./request.js";
import {
  outboundKindValidator,
  outboundStatusValidator,
} from "./validators.js";

const queueOptions = {
  scope: v.string(),
  idempotencyKey: v.optional(v.string()),
  maxAttempts: v.optional(v.number()),
  subAccountId: v.optional(v.string()),
  baseUrl: v.optional(v.string()),
  testMode: v.optional(v.boolean()),
};

/** Delay before re-attempting the post-send write that records a sent request. */
const PERSIST_RETRY_DELAY_MS = 1000;

const enqueueResult = v.object({
  requestId: v.id("outboundRequests"),
  status: outboundStatusValidator,
});

export const enqueueMessage = mutation({
  args: {
    ...queueOptions,
    agentId: v.optional(v.string()),
    toNumber: v.optional(v.string()),
    recipients: v.optional(v.array(v.string())),
    body: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    numberId: v.optional(v.string()),
    fromNumber: v.optional(v.string()),
    channel: v.optional(v.literal("whatsapp")),
    sendStyle: v.optional(v.string()),
    replyToMessageId: v.optional(v.string()),
    buttons: v.optional(v.array(v.string())),
    list: v.optional(v.any()),
  },
  returns: enqueueResult,
  handler: async (ctx, args) => {
    if (Boolean(args.toNumber) === Boolean(args.recipients?.length)) {
      throw new Error("Provide exactly one of toNumber or recipients");
    }
    return await enqueue(ctx, {
      scope: args.scope,
      kind: "message",
      agentId: args.agentId,
      numberId: args.numberId,
      idempotencyKey: args.idempotencyKey,
      maxAttempts: args.maxAttempts,
      payload: stripUndefined({
        body: args.body,
        agent_id: args.agentId,
        to_number: args.toNumber,
        recipients: args.recipients,
        media_urls: args.mediaUrls,
        number_id: args.numberId,
        from_number: args.fromNumber,
        channel: args.channel,
        send_style: args.sendStyle,
        reply_to_message_id: args.replyToMessageId,
        buttons: args.buttons,
        list: args.list,
      }),
      subAccountId: args.subAccountId,
      baseUrl: args.baseUrl,
      testMode: args.testMode,
    });
  },
});

export const enqueueOutboundCall = mutation({
  args: {
    ...queueOptions,
    agentId: v.string(),
    toNumber: v.string(),
    fromNumberId: v.optional(v.string()),
    initialGreeting: v.optional(v.string()),
    voice: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    modelTier: v.optional(v.string()),
    variables: v.optional(v.record(v.string(), v.string())),
    callScreeningIdentity: v.optional(v.string()),
    callScreeningPurpose: v.optional(v.string()),
  },
  returns: enqueueResult,
  handler: async (ctx, args) =>
    await enqueue(ctx, {
      scope: args.scope,
      kind: "outbound_call",
      agentId: args.agentId,
      idempotencyKey: args.idempotencyKey,
      maxAttempts: args.maxAttempts,
      payload: stripUndefined({
        agentId: args.agentId,
        toNumber: args.toNumber,
        fromNumberId: args.fromNumberId,
        initialGreeting: args.initialGreeting,
        voice: args.voice,
        systemPrompt: args.systemPrompt,
        modelTier: args.modelTier,
        variables: args.variables,
        callScreeningIdentity: args.callScreeningIdentity,
        callScreeningPurpose: args.callScreeningPurpose,
      }),
      subAccountId: args.subAccountId,
      baseUrl: args.baseUrl,
      testMode: args.testMode,
    }),
});

export const enqueueWebCall = mutation({
  args: {
    ...queueOptions,
    agentId: v.string(),
    metadata: v.optional(v.any()),
    variables: v.optional(v.record(v.string(), v.string())),
  },
  returns: enqueueResult,
  handler: async (ctx, args) =>
    await enqueue(ctx, {
      scope: args.scope,
      kind: "web_call",
      agentId: args.agentId,
      idempotencyKey: args.idempotencyKey,
      maxAttempts: args.maxAttempts,
      payload: stripUndefined({
        agentId: args.agentId,
        metadata: args.metadata,
        variables: args.variables,
      }),
      subAccountId: args.subAccountId,
      baseUrl: args.baseUrl,
      testMode: args.testMode,
    }),
});

export const getStatus = query({
  args: { scope: v.string(), requestId: v.id("outboundRequests") },
  returns: v.union(schema.tables.outboundRequests.validator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("outboundRequests", args.requestId);
    return row?.scope === args.scope ? withoutSystemFields(row) : null;
  },
});

export const listRequests = query({
  args: {
    scope: v.string(),
    status: v.optional(outboundStatusValidator),
    agentId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(schema.tables.outboundRequests.validator),
  handler: async (ctx, args) => {
    if (args.status && args.agentId) {
      throw new Error(
        "Filter outbound requests by status or agentId, not both",
      );
    }
    const limit = normalizeLimit(args.limit);
    const rows = args.status
      ? await ctx.db
          .query("outboundRequests")
          .withIndex("by_scope_and_status", (q) =>
            q.eq("scope", args.scope).eq("status", args.status!),
          )
          .order("desc")
          .take(limit)
      : args.agentId
        ? await ctx.db
            .query("outboundRequests")
            .withIndex("by_scope_and_agent_id", (q) =>
              q.eq("scope", args.scope).eq("agentId", args.agentId!),
            )
            .order("desc")
            .take(limit)
        : await ctx.db
            .query("outboundRequests")
            .withIndex("by_scope_and_status", (q) => q.eq("scope", args.scope))
            .order("desc")
            .take(limit);
    return rows.map(withoutSystemFields);
  },
});

export const cancel = mutation({
  args: { scope: v.string(), requestId: v.id("outboundRequests") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("outboundRequests", args.requestId);
    if (!row || row.scope !== args.scope || row.status !== "queued") {
      return false;
    }
    await ctx.db.patch("outboundRequests", args.requestId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
    return true;
  },
});

export const processRequest = internalAction({
  args: { requestId: v.id("outboundRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claimed = await ctx.runMutation(internal.outbound.claim, args);
    if (!claimed) return null;

    let result: unknown;
    try {
      result = claimed.testMode
        ? {
            testMode: true,
            status: "skipped",
            kind: claimed.kind,
            args: claimed.payload,
          }
        : await agentPhoneRequest({
            token: requiredApiKey(),
            method: "POST",
            path: pathForKind(claimed.kind),
            body: claimed.payload,
            subAccountId: claimed.subAccountId,
            baseUrl: claimed.baseUrl,
            // The request id is stable across attempts and unique per queued
            // request, so a retry after an ambiguous transport failure repeats
            // the same key instead of looking like a new send.
            idempotencyKey: args.requestId,
          });
    } catch (error) {
      // Only send failures reach this branch, so retrying cannot submit an
      // already-recorded request a second time.
      const retry =
        claimed.attempt < claimed.maxAttempts && isRetryableError(error);
      const delayMs = retryDelayMs(claimed.attempt);
      await ctx.runMutation(internal.outbound.markFailed, {
        requestId: args.requestId,
        error: error instanceof Error ? error.message : String(error),
        retry,
        ...(retry && { nextAttemptAt: Date.now() + delayMs }),
      });
      if (retry) {
        await ctx.scheduler.runAfter(
          delayMs,
          internal.outbound.processRequest,
          args,
        );
      }
      return null;
    }

    // AgentPhone accepted the request. Everything below only persists that
    // outcome, so failures here are never retried through the send path.
    const markSentArgs = { requestId: args.requestId, result };
    try {
      await ctx.runMutation(internal.outbound.markSent, markSentArgs);
    } catch (error) {
      console.error(
        "AgentPhone request sent but recording it failed; retrying the write",
        error,
      );
      await ctx.scheduler.runAfter(
        PERSIST_RETRY_DELAY_MS,
        internal.outbound.markSent,
        markSentArgs,
      );
    }

    try {
      if (claimed.kind === "message") {
        await ctx.runMutation(internal.resources.upsertMessagesFromResponse, {
          scope: claimed.scope,
          response: result,
        });
      } else {
        await ctx.runMutation(internal.resources.upsertCallsFromResponse, {
          scope: claimed.scope,
          response: result,
        });
      }
      await ctx.runMutation(internal.events.recordApiEvent, {
        scope: claimed.scope,
        eventType: claimed.kind === "message" ? "message.sent" : "call.created",
        ...(claimed.agentId && { agentId: claimed.agentId }),
        direction: "outbound",
        payload: result,
      });
    } catch (error) {
      console.error(
        "AgentPhone request sent but local state sync failed",
        error,
      );
    }
    return null;
  },
});

export const claim = internalMutation({
  args: { requestId: v.id("outboundRequests") },
  returns: v.union(
    v.object({
      scope: v.string(),
      kind: outboundKindValidator,
      payload: v.any(),
      agentId: v.optional(v.string()),
      subAccountId: v.optional(v.string()),
      baseUrl: v.optional(v.string()),
      testMode: v.boolean(),
      attempt: v.number(),
      maxAttempts: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("outboundRequests", args.requestId);
    if (!row || row.status !== "queued") return null;
    const attempt = row.attempts + 1;
    const stored = row.args as {
      payload: unknown;
      subAccountId?: string;
      baseUrl?: string;
      testMode?: boolean;
    };
    await ctx.db.patch("outboundRequests", args.requestId, {
      status: "sending",
      attempts: attempt,
      updatedAt: Date.now(),
    });
    return {
      scope: row.scope,
      kind: row.kind,
      payload: stored.payload,
      ...(row.agentId && { agentId: row.agentId }),
      ...(stored.subAccountId && { subAccountId: stored.subAccountId }),
      ...(stored.baseUrl && { baseUrl: stored.baseUrl }),
      testMode: stored.testMode ?? false,
      attempt,
      maxAttempts: row.maxAttempts,
    };
  },
});

export const markSent = internalMutation({
  args: { requestId: v.id("outboundRequests"), result: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("outboundRequests", args.requestId);
    if (row) {
      const result = asRecord(args.result);
      await ctx.db.patch("outboundRequests", args.requestId, {
        status: "sent",
        result: args.result,
        error: undefined,
        nextAttemptAt: undefined,
        messageId: stringField(result, ["message_id", "messageId", "id"]),
        callId: stringField(result, ["call_id", "callId", "id"]),
        conversationId: stringField(result, [
          "conversation_id",
          "conversationId",
        ]),
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

export const markFailed = internalMutation({
  args: {
    requestId: v.id("outboundRequests"),
    error: v.string(),
    retry: v.boolean(),
    nextAttemptAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("outboundRequests", args.requestId);
    if (row) {
      await ctx.db.patch("outboundRequests", args.requestId, {
        status: args.retry ? "queued" : "failed",
        error: args.error,
        nextAttemptAt: args.nextAttemptAt,
        updatedAt: Date.now(),
      });
    }
    return null;
  },
});

async function enqueue(
  ctx: MutationCtx,
  args: {
    scope: string;
    kind: "message" | "outbound_call" | "web_call";
    payload: unknown;
    agentId?: string;
    numberId?: string;
    idempotencyKey?: string;
    maxAttempts?: number;
    subAccountId?: string;
    baseUrl?: string;
    testMode?: boolean;
  },
) {
  if (args.idempotencyKey) {
    const existing = await ctx.db
      .query("outboundRequests")
      .withIndex("by_scope_and_idempotency_key", (q) =>
        q.eq("scope", args.scope).eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (existing) {
      return { requestId: existing._id, status: existing.status };
    }
  }
  const maxAttempts = args.maxAttempts ?? 1;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) {
    throw new Error("maxAttempts must be an integer between 1 and 5");
  }
  const now = Date.now();
  const requestId = await ctx.db.insert("outboundRequests", {
    scope: args.scope,
    kind: args.kind,
    status: "queued",
    args: stripUndefined({
      payload: args.payload,
      subAccountId: args.subAccountId,
      baseUrl: args.baseUrl,
      testMode: args.testMode,
    }),
    ...(args.idempotencyKey && { idempotencyKey: args.idempotencyKey }),
    ...(args.agentId && { agentId: args.agentId }),
    ...(args.numberId && { numberId: args.numberId }),
    attempts: 0,
    maxAttempts,
    createdAt: now,
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.outbound.processRequest, {
    requestId,
  });
  return { requestId, status: "queued" as const };
}

function pathForKind(kind: "message" | "outbound_call" | "web_call") {
  if (kind === "message") return "messages";
  if (kind === "outbound_call") return "calls";
  return "calls/web";
}

function requiredApiKey() {
  const value = process.env.AGENTPHONE_API_KEY;
  if (!value) {
    throw new Error(
      "Durable AgentPhone sends require AGENTPHONE_API_KEY in Convex environment variables",
    );
  }
  return value;
}

/**
 * Retry transport failures and AgentPhone statuses that can succeed later.
 * Rejected requests, expired credentials, and forbidden operations are
 * terminal, so resubmitting them only delays the failure.
 */
function isRetryableError(error: unknown) {
  if (error instanceof AgentPhoneApiError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  return true;
}

function retryDelayMs(attempt: number) {
  return Math.min(1000 * 2 ** Math.max(0, attempt - 1), 30 * 60 * 1000);
}

function normalizeLimit(value: number | undefined) {
  if (value === undefined) return 50;
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

function asRecord(value: unknown) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringField(value: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (typeof value[key] === "string") return value[key];
  }
  return undefined;
}

function withoutSystemFields<T extends { _id: unknown; _creationTime: number }>(
  row: T,
) {
  const { _id: _ignoredId, _creationTime: _ignoredTime, ...value } = row;
  return value;
}
