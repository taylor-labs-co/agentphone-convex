import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";

import { callAgentPhoneSdk } from "./lib/sdk.js";
import { json, stripUndefined } from "./lib/validators.js";

const outboundKind = v.union(
  v.literal("message"),
  v.literal("outboundCall"),
  v.literal("webCall"),
);

const outboundStatus = v.union(
  v.literal("queued"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("failed"),
  v.literal("cancelled"),
);

const queueOptions = {
  idempotency_key: v.optional(v.string()),
  max_attempts: v.optional(v.number()),
  test_mode: v.optional(v.boolean()),
};

export const enqueueMessage = mutation({
  args: {
    agent_id: v.string(),
    to_number: v.string(),
    body: v.optional(v.string()),
    media_urls: v.optional(v.array(v.string())),
    channel: v.optional(v.union(v.literal("sms"), v.literal("imessage"))),
    metadata: v.optional(json),
    ...queueOptions,
  },
  returns: v.object({ requestId: v.string(), status: outboundStatus }),
  handler: async (ctx, args) =>
    enqueue(ctx, {
      kind: "message",
      args,
      agentId: args.agent_id,
      idempotencyKey: args.idempotency_key,
      maxAttempts: args.max_attempts,
    }),
});

export const enqueueOutboundCall = mutation({
  args: {
    agent_id: v.string(),
    to_number: v.string(),
    from_number_id: v.optional(v.string()),
    metadata: v.optional(json),
    ...queueOptions,
  },
  returns: v.object({ requestId: v.string(), status: outboundStatus }),
  handler: async (ctx, args) =>
    enqueue(ctx, {
      kind: "outboundCall",
      args,
      agentId: args.agent_id,
      numberId: args.from_number_id,
      idempotencyKey: args.idempotency_key,
      maxAttempts: args.max_attempts,
    }),
});

export const enqueueWebCall = mutation({
  args: {
    agent_id: v.string(),
    metadata: v.optional(json),
    ...queueOptions,
  },
  returns: v.object({ requestId: v.string(), status: outboundStatus }),
  handler: async (ctx, args) =>
    enqueue(ctx, {
      kind: "webCall",
      args,
      agentId: args.agent_id,
      idempotencyKey: args.idempotency_key,
      maxAttempts: args.max_attempts,
    }),
});

export const getStatus = query({
  args: { requestId: v.string() },
  returns: v.union(json, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.requestId as any);
    return row ? stripSystemField(row as any) : null;
  },
});

export const listRequests = query({
  args: {
    status: v.optional(outboundStatus),
    agentId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(json),
  handler: async (ctx, args) => {
    const max = Math.min(args.limit ?? 50, 200);
    if (args.status) {
      return stripSystemFields(
        await ctx.db
          .query("outboundRequests")
          .withIndex("by_status", (q) => q.eq("status", args.status!))
          .order("desc")
          .take(max),
      );
    }
    if (args.agentId) {
      return stripSystemFields(
        await ctx.db
          .query("outboundRequests")
          .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
          .order("desc")
          .take(max),
      );
    }
    return stripSystemFields(
      await ctx.db.query("outboundRequests").order("desc").take(max),
    );
  },
});

export const cancel = mutation({
  args: { requestId: v.string() },
  returns: v.object({ cancelled: v.boolean() }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.requestId as any);
    if (!row || row.status === "sent" || row.status === "cancelled") {
      return { cancelled: false };
    }
    await ctx.db.patch(row._id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
    return { cancelled: true };
  },
});

export const getRequestForProcessing = internalQuery({
  args: { requestId: v.id("outboundRequests") },
  returns: v.union(json, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.requestId);
    return row ? stripSystemField(row as any) : null;
  },
});

export const markSending = internalMutation({
  args: { requestId: v.id("outboundRequests") },
  returns: v.number(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.requestId);
    if (!row) {
      return 0;
    }
    const attempts = row.attempts + 1;
    await ctx.db.patch(args.requestId, {
      status: "sending",
      attempts,
      updatedAt: Date.now(),
    });
    return attempts;
  },
});

export const markSent = internalMutation({
  args: {
    requestId: v.id("outboundRequests"),
    result: json,
    messageId: v.optional(v.string()),
    callId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.requestId, stripUndefined({
      status: "sent",
      result: args.result,
      messageId: args.messageId,
      callId: args.callId,
      conversationId: args.conversationId,
      updatedAt: Date.now(),
    }));
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
    await ctx.db.patch(args.requestId, stripUndefined({
      status: args.retry ? "queued" : "failed",
      error: args.error,
      nextAttemptAt: args.nextAttemptAt,
      updatedAt: Date.now(),
    }));
    return null;
  },
});

export const process = internalAction({
  args: { requestId: v.id("outboundRequests") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = (await ctx.runQuery(
      internal.outbound.getRequestForProcessing,
      args,
    )) as any;
    if (
      !request ||
      request.status === "cancelled" ||
      request.status === "sent"
    ) {
      return null;
    }
    const attempt = await ctx.runMutation(internal.outbound.markSending, args);
    try {
      const callArgs = stripUndefined({
        ...(request.args as Record<string, unknown>),
        idempotency_key: undefined,
        max_attempts: undefined,
        test_mode: undefined,
      });
      const result = request.args?.test_mode
        ? {
            testMode: true,
            status: "skipped",
            kind: request.kind,
            args: callArgs,
          }
        : await sendNow(request.kind, callArgs);

      await upsertResult(ctx, request.kind, result);
      await ctx.runMutation(internal.outbound.markSent, {
        requestId: args.requestId,
        result,
        messageId: extractId(result, ["message_id", "messageId", "id"]),
        callId: extractId(result, ["call_id", "callId", "id"]),
        conversationId: extractId(result, [
          "conversation_id",
          "conversationId",
        ]),
      });
    } catch (error) {
      const maxAttempts = request.maxAttempts ?? 1;
      const retry = attempt < maxAttempts;
      const nextAttemptAt = retry ? Date.now() + retryDelayMs(attempt) : undefined;
      await ctx.runMutation(internal.outbound.markFailed, {
        requestId: args.requestId,
        error: error instanceof Error ? error.message : String(error),
        retry,
        nextAttemptAt,
      });
      if (retry) {
        await ctx.scheduler.runAfter(retryDelayMs(attempt), internal.outbound.process, {
          requestId: args.requestId,
        });
      }
    }
    return null;
  },
});

async function enqueue(
  ctx: any,
  args: {
    kind: "message" | "outboundCall" | "webCall";
    args: Record<string, unknown>;
    agentId?: string | undefined;
    numberId?: string | undefined;
    idempotencyKey?: string | undefined;
    maxAttempts?: number | undefined;
  },
) {
  if (args.idempotencyKey) {
    const existing = await ctx.db
      .query("outboundRequests")
      .withIndex("by_idempotencyKey", (q: any) =>
        q.eq("idempotencyKey", args.idempotencyKey),
      )
      .first();
    if (existing) {
      return { requestId: existing._id, status: existing.status };
    }
  }
  const now = Date.now();
  const requestId = await ctx.db.insert("outboundRequests", {
    kind: args.kind,
    status: "queued",
    args: stripUndefined(args.args),
    idempotencyKey: args.idempotencyKey,
    agentId: args.agentId,
    numberId: args.numberId,
    attempts: 0,
    maxAttempts: Math.max(1, args.maxAttempts ?? 1),
    createdAt: now,
    updatedAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.outbound.process, { requestId });
  return { requestId, status: "queued" };
}

async function sendNow(kind: string, args: Record<string, unknown>) {
  if (kind === "message") {
    return callAgentPhoneSdk("messages", "sendMessage", args);
  }
  if (kind === "outboundCall") {
    return callAgentPhoneSdk("calls", "createOutboundCall", args);
  }
  return callAgentPhoneSdk("calls", "createWebCall", args);
}

async function upsertResult(ctx: any, kind: string, result: unknown) {
  if (kind === "message") {
    await ctx.runMutation(internal.resources.upsertMessagesFromResponse, {
      response: result,
    });
  } else {
    await ctx.runMutation(internal.resources.upsertCallsFromResponse, {
      response: result,
    });
  }
}

function retryDelayMs(attempt: number) {
  return Math.min(1000 * 2 ** Math.max(0, attempt - 1), 30 * 60 * 1000);
}

function extractId(result: unknown, keys: string[]) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    return undefined;
  }
  const record = result as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

function stripSystemFields(rows: Array<Record<string, unknown>>) {
  return rows.map(stripSystemField);
}

function stripSystemField(row: Record<string, unknown>) {
  const { _id, _creationTime, ...rest } = row;
  return { ...rest, requestId: _id };
}
