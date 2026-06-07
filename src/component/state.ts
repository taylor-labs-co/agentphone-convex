import { internalMutation, internalQuery } from "./_generated/server.js";
import { v } from "convex/values";

import {
  callbackName,
  json,
  normalizedWebhookEvent,
  webhookCallbackHandles,
} from "./lib/validators.js";

const CALLBACK_KEY = "default";

function callbackKey(agentId: string | undefined) {
  return agentId ? `agent:${agentId}` : CALLBACK_KEY;
}

export const registerCallbacks = internalMutation({
  args: {
    agentId: v.optional(v.string()),
    callbacks: webhookCallbackHandles,
  },
  returns: v.object({
    key: v.string(),
    callbacks: webhookCallbackHandles,
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const key = callbackKey(args.agentId);
    const existing = await ctx.db
      .query("callbackConfigs")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        agentId: args.agentId,
        handles: args.callbacks,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("callbackConfigs", {
        key,
        agentId: args.agentId,
        handles: args.callbacks,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { key, callbacks: args.callbacks };
  },
});

export const getCallbacks = internalQuery({
  args: {
    agentId: v.optional(v.string()),
  },
  returns: webhookCallbackHandles,
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("callbackConfigs")
      .withIndex("by_key", (q) => q.eq("key", callbackKey(args.agentId)))
      .unique();
    return config?.handles ?? {};
  },
});

export const getCallbacksInternal = internalQuery({
  args: {},
  returns: webhookCallbackHandles,
  handler: async (ctx) => {
    const config = await ctx.db
      .query("callbackConfigs")
      .withIndex("by_key", (q) => q.eq("key", CALLBACK_KEY))
      .unique();
    return config?.handles ?? {};
  },
});

export const getCallbackHandle = internalQuery({
  args: {
    agentId: v.optional(v.string()),
    callback: callbackName,
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    if (args.agentId) {
      const agentConfig = await ctx.db
        .query("callbackConfigs")
        .withIndex("by_key", (q) => q.eq("key", callbackKey(args.agentId)))
        .unique();
      const handle = agentConfig?.handles[args.callback];
      if (handle) {
        return handle;
      }
    }
    const defaultConfig = await ctx.db
      .query("callbackConfigs")
      .withIndex("by_key", (q) => q.eq("key", CALLBACK_KEY))
      .unique();
    return defaultConfig?.handles[args.callback] ?? null;
  },
});

export const upsertWebhookConfig = internalMutation({
  args: {
    scope: v.union(v.literal("project"), v.literal("agent")),
    agentId: v.optional(v.string()),
    providerWebhookId: v.optional(v.string()),
    url: v.string(),
    secret: v.optional(v.string()),
    status: v.optional(v.string()),
    eventTypes: v.optional(v.array(v.string())),
    contextLimit: v.optional(v.number()),
    timeoutMs: v.optional(v.number()),
    providerResponse: v.optional(json),
  },
  returns: v.object({
    key: v.string(),
    hasSecret: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const key = args.scope === "agent" ? `agent:${args.agentId}` : "project";
    const existing = await ctx.db
      .query("webhookConfigs")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    const patch = {
      scope: args.scope,
      key,
      agentId: args.agentId,
      providerWebhookId: args.providerWebhookId,
      url: args.url,
      secret: args.secret,
      status: args.status,
      eventTypes: args.eventTypes,
      contextLimit: args.contextLimit,
      timeoutMs: args.timeoutMs,
      providerResponse: args.providerResponse,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("webhookConfigs", {
        ...patch,
        createdAt: now,
      });
    }
    return { key, hasSecret: Boolean(args.secret) };
  },
});

export const deleteWebhookConfig = internalMutation({
  args: {
    scope: v.union(v.literal("project"), v.literal("agent")),
    agentId: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const key = args.scope === "agent" ? `agent:${args.agentId}` : "project";
    const existing = await ctx.db
      .query("webhookConfigs")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (!existing) {
      return false;
    }
    await ctx.db.delete(existing._id);
    return true;
  },
});

export const getWebhookSecret = internalQuery({
  args: {
    agentId: v.optional(v.string()),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    if (args.agentId) {
      const agentConfig = await ctx.db
        .query("webhookConfigs")
        .withIndex("by_key", (q) => q.eq("key", `agent:${args.agentId}`))
        .unique();
      if (agentConfig?.secret) {
        return agentConfig.secret;
      }
    }
    const projectConfig = await ctx.db
      .query("webhookConfigs")
      .withIndex("by_key", (q) => q.eq("key", "project"))
      .unique();
    return projectConfig?.secret ?? null;
  },
});

export const listStoredWebhookConfigs = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      scope: v.union(v.literal("project"), v.literal("agent")),
      key: v.string(),
      agentId: v.optional(v.string()),
      providerWebhookId: v.optional(v.string()),
      url: v.string(),
      status: v.optional(v.string()),
      eventTypes: v.optional(v.array(v.string())),
      contextLimit: v.optional(v.number()),
      timeoutMs: v.optional(v.number()),
      hasSecret: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const configs = await ctx.db.query("webhookConfigs").collect();
    return configs.map(({ secret, providerResponse: _providerResponse, ...config }) => ({
      ...config,
      hasSecret: Boolean(secret),
    }));
  },
});

export const recordWebhookDelivery = internalMutation({
  args: {
    webhookId: v.string(),
    signature: v.optional(v.string()),
    timestamp: v.optional(v.string()),
    normalized: normalizedWebhookEvent,
    payload: json,
  },
  returns: v.object({
    duplicate: v.boolean(),
    callback: v.optional(callbackName),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_webhookId", (q) => q.eq("webhookId", args.webhookId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "duplicate",
        processedAt: Date.now(),
      });
      return { duplicate: true, callback: existing.callback };
    }

    const now = Date.now();
    await ctx.db.insert("webhookDeliveries", {
      webhookId: args.webhookId,
      signature: args.signature,
      timestamp: args.timestamp,
      event: args.normalized.event,
      channel: args.normalized.channel,
      agentId: args.normalized.agentId,
      status: "received",
      callback: args.normalized.callback,
      attempts: 0,
      maxAttempts: 3,
      receivedAt: now,
    });
    await ctx.db.insert("webhookEvents", {
      webhookId: args.webhookId,
      event: args.normalized.event,
      channel: args.normalized.channel,
      agentId: args.normalized.agentId,
      callback: args.normalized.callback,
      payload: args.payload,
      normalized: args.normalized,
      receivedAt: now,
    });
    return { duplicate: false, callback: args.normalized.callback };
  },
});

export const markWebhookDelivery = internalMutation({
  args: {
    webhookId: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("duplicate"),
      v.literal("retrying"),
      v.literal("dispatched"),
      v.literal("failed"),
      v.literal("dead_letter"),
      v.literal("ignored"),
    ),
    error: v.optional(v.string()),
    attempts: v.optional(v.number()),
    maxAttempts: v.optional(v.number()),
    nextAttemptAt: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_webhookId", (q) => q.eq("webhookId", args.webhookId))
      .unique();
    if (!existing) {
      return null;
    }
    await ctx.db.patch(existing._id, {
      ...stripUndefined({
        status: args.status,
        error: args.error,
        attempts: args.attempts,
        maxAttempts: args.maxAttempts,
        nextAttemptAt: args.nextAttemptAt,
        lastAttemptAt: args.lastAttemptAt,
      }),
      processedAt: Date.now(),
    });
    return null;
  },
});

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

export const getWebhookEvent = internalQuery({
  args: {
    webhookId: v.string(),
  },
  returns: v.union(json, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("webhookEvents")
      .withIndex("by_webhookId", (q) => q.eq("webhookId", args.webhookId))
      .unique();
  },
});

export const getWebhookDelivery = internalQuery({
  args: {
    webhookId: v.string(),
  },
  returns: v.union(json, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_webhookId", (q) => q.eq("webhookId", args.webhookId))
      .unique();
  },
});

export const listDeliveries = internalQuery({
  args: {
    limit: v.optional(v.number()),
    agentId: v.optional(v.string()),
    event: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("received"),
        v.literal("duplicate"),
        v.literal("retrying"),
        v.literal("dispatched"),
        v.literal("failed"),
        v.literal("dead_letter"),
        v.literal("ignored"),
      ),
    ),
  },
  returns: v.array(json),
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 50, 200);
    if (args.agentId) {
      return await ctx.db
        .query("webhookDeliveries")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
        .order("desc")
        .take(limit);
    }
    if (args.event) {
      return await ctx.db
        .query("webhookDeliveries")
        .withIndex("by_event", (q) => q.eq("event", args.event))
        .order("desc")
        .take(limit);
    }
    if (args.status) {
      return await ctx.db
        .query("webhookDeliveries")
        .withIndex("by_status", (q) => q.eq("status", args.status))
        .order("desc")
        .take(limit);
    }
    return await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_receivedAt")
      .order("desc")
      .take(limit);
  },
});

export const cleanupWebhookDeliveries = internalMutation({
  args: {
    olderThan: v.number(),
    statuses: v.optional(
      v.array(
        v.union(
          v.literal("received"),
          v.literal("duplicate"),
          v.literal("retrying"),
          v.literal("dispatched"),
          v.literal("failed"),
          v.literal("dead_letter"),
          v.literal("ignored"),
        ),
      ),
    ),
  },
  returns: v.object({
    deletedDeliveries: v.number(),
    deletedEvents: v.number(),
  }),
  handler: async (ctx, args) => {
    const statuses = new Set(args.statuses);
    const deliveries = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_receivedAt")
      .collect();
    let deletedDeliveries = 0;
    for (const delivery of deliveries) {
      if (
        delivery.receivedAt < args.olderThan &&
        (!args.statuses || statuses.has(delivery.status))
      ) {
        await ctx.db.delete(delivery._id);
        deletedDeliveries += 1;
      }
    }

    const events = await ctx.db.query("webhookEvents").withIndex("by_receivedAt").collect();
    let deletedEvents = 0;
    for (const event of events) {
      if (event.receivedAt < args.olderThan) {
        await ctx.db.delete(event._id);
        deletedEvents += 1;
      }
    }

    return { deletedDeliveries, deletedEvents };
  },
});
