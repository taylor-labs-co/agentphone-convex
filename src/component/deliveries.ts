import type { FunctionHandle } from "convex/server";
import { v, type Infer, type VString } from "convex/values";
import { internal } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
import type { MutationCtx } from "./_generated/server.js";
import {
  action,
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server.js";
import schema from "./schema.js";
import {
  agentPhoneEventValidator,
  deliveryStatusValidator,
  voiceWebhookResponseValidator,
} from "./validators.js";

type WebhookEvent = Infer<typeof agentPhoneEventValidator>;
type CallbackResult = Infer<typeof voiceWebhookResponseValidator> | null;

export const eventCallbackValidator = v.string() as VString<
  FunctionHandle<"mutation", { event: WebhookEvent }, CallbackResult>
>;

export async function recordDelivery(
  ctx: MutationCtx,
  args: {
    scope: string;
    deliveryId: string;
    eventId: Id<"events">;
    event: WebhookEvent;
    callback?: FunctionHandle<
      "mutation",
      { event: WebhookEvent },
      CallbackResult
    >;
  },
) {
  const receivedAt = Date.now();
  const synchronous = args.event.channel === "voice";
  const status = args.callback
    ? synchronous
      ? "dispatching"
      : "received"
    : "ignored";
  const deliveryDocId = await ctx.db.insert("webhookDeliveries", {
    scope: args.scope,
    deliveryId: args.deliveryId,
    eventId: args.eventId,
    eventType: args.event.event,
    channel: args.event.channel,
    ...(args.event.agentId && { agentId: args.event.agentId }),
    ...(args.callback && { callback: args.callback }),
    status,
    attempts: synchronous && args.callback ? 1 : 0,
    maxAttempts: 3,
    receivedAt,
    ...(status === "ignored" && { processedAt: receivedAt }),
  });

  if (!args.callback) {
    return null;
  }
  if (synchronous) {
    const result =
      (await ctx.runMutation(args.callback, { event: args.event })) ?? null;
    await ctx.db.patch("webhookDeliveries", deliveryDocId, {
      status: "dispatched",
      lastAttemptAt: Date.now(),
      processedAt: Date.now(),
    });
    return result;
  }

  await ctx.scheduler.runAfter(0, internal.deliveries.dispatchCallback, {
    deliveryDocId,
  });
  return null;
}

export const dispatchCallback = internalAction({
  args: { deliveryDocId: v.id("webhookDeliveries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claimed = await ctx.runMutation(
      internal.deliveries.claimForDispatch,
      args,
    );
    if (!claimed) {
      return null;
    }

    try {
      await ctx.runMutation(claimed.callback, { event: claimed.event });
      await ctx.runMutation(internal.deliveries.markDispatched, args);
    } catch (error) {
      const shouldRetry = claimed.attempt < claimed.maxAttempts;
      const delayMs = retryDelayMs(claimed.attempt);
      await ctx.runMutation(internal.deliveries.markFailed, {
        ...args,
        error: error instanceof Error ? error.message : String(error),
        retry: shouldRetry,
        ...(shouldRetry && { nextAttemptAt: Date.now() + delayMs }),
      });
      if (shouldRetry) {
        await ctx.scheduler.runAfter(
          delayMs,
          internal.deliveries.dispatchCallback,
          args,
        );
      }
    }
    return null;
  },
});

export const claimForDispatch = internalMutation({
  args: { deliveryDocId: v.id("webhookDeliveries") },
  returns: v.union(
    v.object({
      callback: eventCallbackValidator,
      event: agentPhoneEventValidator,
      attempt: v.number(),
      maxAttempts: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("webhookDeliveries", args.deliveryDocId);
    if (
      !delivery?.callback ||
      (delivery.status !== "received" && delivery.status !== "retrying")
    ) {
      return null;
    }
    const event = await ctx.db.get("events", delivery.eventId);
    if (!event || event.source !== "webhook") {
      await ctx.db.patch("webhookDeliveries", args.deliveryDocId, {
        status: "failed",
        error: "Webhook event is missing",
        processedAt: Date.now(),
      });
      return null;
    }
    const attempt = delivery.attempts + 1;
    await ctx.db.patch("webhookDeliveries", args.deliveryDocId, {
      status: "dispatching",
      attempts: attempt,
      lastAttemptAt: Date.now(),
    });
    return {
      callback: delivery.callback as FunctionHandle<
        "mutation",
        { event: WebhookEvent },
        CallbackResult
      >,
      event: event.payload as WebhookEvent,
      attempt,
      maxAttempts: delivery.maxAttempts,
    };
  },
});

export const markDispatched = internalMutation({
  args: { deliveryDocId: v.id("webhookDeliveries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("webhookDeliveries", args.deliveryDocId);
    if (delivery) {
      await ctx.db.patch("webhookDeliveries", args.deliveryDocId, {
        status: "dispatched",
        processedAt: Date.now(),
        error: undefined,
        nextAttemptAt: undefined,
      });
    }
    return null;
  },
});

export const markFailed = internalMutation({
  args: {
    deliveryDocId: v.id("webhookDeliveries"),
    error: v.string(),
    retry: v.boolean(),
    nextAttemptAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get("webhookDeliveries", args.deliveryDocId);
    if (delivery) {
      await ctx.db.patch("webhookDeliveries", args.deliveryDocId, {
        status: args.retry ? "retrying" : "dead_letter",
        error: args.error,
        nextAttemptAt: args.nextAttemptAt,
        ...(!args.retry && { processedAt: Date.now() }),
      });
    }
    return null;
  },
});

export const list = query({
  args: {
    scope: v.string(),
    status: v.optional(deliveryStatusValidator),
    agentId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(schema.tables.webhookDeliveries.validator),
  handler: async (ctx, args) => {
    if (args.status && args.agentId) {
      throw new Error("Filter deliveries by status or agentId, not both");
    }
    const limit = normalizeLimit(args.limit);
    const rows = args.status
      ? await ctx.db
          .query("webhookDeliveries")
          .withIndex("by_scope_and_status", (q) =>
            q.eq("scope", args.scope).eq("status", args.status!),
          )
          .order("desc")
          .take(limit)
      : args.agentId
        ? await ctx.db
            .query("webhookDeliveries")
            .withIndex("by_scope_and_agent_id", (q) =>
              q.eq("scope", args.scope).eq("agentId", args.agentId!),
            )
            .order("desc")
            .take(limit)
        : await ctx.db
            .query("webhookDeliveries")
            .withIndex("by_scope_and_received_at", (q) =>
              q.eq("scope", args.scope),
            )
            .order("desc")
            .take(limit);
    return rows.map(withoutSystemFields);
  },
});

export const listFailed = query({
  args: { scope: v.string(), limit: v.optional(v.number()) },
  returns: v.array(schema.tables.webhookDeliveries.validator),
  handler: async (ctx, args) => {
    const limit = normalizeLimit(args.limit);
    const [failed, deadLetters] = await Promise.all([
      ctx.db
        .query("webhookDeliveries")
        .withIndex("by_scope_and_status", (q) =>
          q.eq("scope", args.scope).eq("status", "failed"),
        )
        .order("desc")
        .take(limit),
      ctx.db
        .query("webhookDeliveries")
        .withIndex("by_scope_and_status", (q) =>
          q.eq("scope", args.scope).eq("status", "dead_letter"),
        )
        .order("desc")
        .take(limit),
    ]);
    return [...failed, ...deadLetters]
      .sort((left, right) => right.receivedAt - left.receivedAt)
      .slice(0, limit)
      .map(withoutSystemFields);
  },
});

export const replay = action({
  args: { scope: v.string(), deliveryId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const deliveryDocId = await ctx.runMutation(
      internal.deliveries.prepareReplay,
      args,
    );
    if (!deliveryDocId) return false;
    await ctx.scheduler.runAfter(0, internal.deliveries.dispatchCallback, {
      deliveryDocId,
    });
    return true;
  },
});

export const prepareReplay = internalMutation({
  args: { scope: v.string(), deliveryId: v.string() },
  returns: v.union(v.id("webhookDeliveries"), v.null()),
  handler: async (ctx, args) => {
    const delivery = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_scope_and_delivery_id", (q) =>
        q.eq("scope", args.scope).eq("deliveryId", args.deliveryId),
      )
      .unique();
    if (!delivery?.callback || delivery.status === "dispatched") {
      return null;
    }
    await ctx.db.patch("webhookDeliveries", delivery._id, {
      status: "retrying",
      attempts: 0,
      error: undefined,
      nextAttemptAt: undefined,
      processedAt: undefined,
    });
    return delivery._id;
  },
});

export const cleanup = mutation({
  args: {
    scope: v.string(),
    olderThan: v.number(),
    limit: v.optional(v.number()),
    statuses: v.optional(v.array(deliveryStatusValidator)),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_scope_and_received_at", (q) =>
        q.eq("scope", args.scope).lt("receivedAt", args.olderThan),
      )
      .take(normalizeLimit(args.limit));
    const selected = args.statuses
      ? rows.filter((row) => args.statuses!.includes(row.status))
      : rows;
    for (const row of selected) {
      await ctx.db.delete("events", row.eventId);
      await ctx.db.delete("webhookDeliveries", row._id);
    }
    return selected.length;
  },
});

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

function withoutSystemFields<T extends { _id: unknown; _creationTime: number }>(
  row: T,
) {
  const { _id: _ignoredId, _creationTime: _ignoredTime, ...value } = row;
  return value;
}
