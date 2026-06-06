import { action, mutation, query } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";

import { callAgentPhoneSdk } from "./lib/sdk.js";
import {
  extractWebhookSecret,
  normalizeWebhookPayload,
  parseWebhookBody,
  redactedWebhookConfig,
} from "./lib/webhookPayload.js";
import { verifyAgentPhoneSignature } from "./lib/webhookSecurity.js";
import {
  json,
  normalizedWebhookEvent,
  paginationArgs,
  stripUndefined,
  webhookCallbackHandles,
} from "./lib/validators.js";

const CALLBACK_KEY = "default";

export const registerCallbacks = mutation({
  args: {
    callbacks: webhookCallbackHandles,
  },
  returns: v.object({
    key: v.string(),
    callbacks: webhookCallbackHandles,
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("callbackConfigs")
      .withIndex("by_key", (q) => q.eq("key", CALLBACK_KEY))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        handles: args.callbacks,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("callbackConfigs", {
        key: CALLBACK_KEY,
        handles: args.callbacks,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { key: CALLBACK_KEY, callbacks: args.callbacks };
  },
});

export const getCallbacks = query({
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

export const getProjectWebhook = action({
  args: {},
  returns: json,
  handler: async () => callAgentPhoneSdk("webhooks", "getWebhook"),
});

export const configureProjectWebhook = action({
  args: {
    url: v.string(),
    event_types: v.optional(v.array(v.string())),
    context_limit: v.optional(v.number()),
    timeout_ms: v.optional(v.number()),
  },
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "webhooks",
      "createOrUpdateWebhook",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.state.upsertWebhookConfig, {
      scope: "project",
      url: args.url,
      secret: extractWebhookSecret(response),
      eventTypes: args.event_types,
      contextLimit: args.context_limit,
      timeoutMs: args.timeout_ms,
      providerResponse: response,
    });
    return redactedWebhookConfig(response as Record<string, unknown>);
  },
});

export const deleteProjectWebhook = action({
  args: {},
  returns: json,
  handler: async (ctx) => {
    const response = await callAgentPhoneSdk("webhooks", "deleteWebhook");
    await ctx.runMutation(internal.state.deleteWebhookConfig, {
      scope: "project",
    });
    return response;
  },
});

export const testProjectWebhook = action({
  args: {
    event_type: v.optional(v.string()),
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("webhooks", "testWebhook", stripUndefined(args)),
});

export const getAgentWebhook = action({
  args: {
    agent_id: v.string(),
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("agentWebhooks", "getAgentWebhook", args),
});

export const configureAgentWebhook = action({
  args: {
    agent_id: v.string(),
    url: v.string(),
    event_types: v.optional(v.array(v.string())),
    context_limit: v.optional(v.number()),
    timeout_ms: v.optional(v.number()),
  },
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "agentWebhooks",
      "createOrUpdateAgentWebhook",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.state.upsertWebhookConfig, {
      scope: "agent",
      agentId: args.agent_id,
      url: args.url,
      secret: extractWebhookSecret(response),
      eventTypes: args.event_types,
      contextLimit: args.context_limit,
      timeoutMs: args.timeout_ms,
      providerResponse: response,
    });
    return redactedWebhookConfig(response as Record<string, unknown>);
  },
});

export const deleteAgentWebhook = action({
  args: {
    agent_id: v.string(),
  },
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "agentWebhooks",
      "deleteAgentWebhook",
      args,
    );
    await ctx.runMutation(internal.state.deleteWebhookConfig, {
      scope: "agent",
      agentId: args.agent_id,
    });
    return response;
  },
});

export const listAgentDeliveries = action({
  args: {
    agent_id: v.string(),
    ...paginationArgs,
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk(
      "agentWebhooks",
      "listAgentDeliveries",
      stripUndefined(args),
    ),
});

export const testAgentWebhook = action({
  args: {
    agent_id: v.string(),
    event_type: v.optional(v.string()),
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk(
      "agentWebhooks",
      "testAgentWebhook",
      stripUndefined(args),
    ),
});

export const listProviderDeliveries = action({
  args: paginationArgs,
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("webhooks", "listDeliveries", stripUndefined(args)),
});

export const deliveryStats = action({
  args: {
    hours: v.optional(v.number()),
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("webhooks", "deliveryStats", stripUndefined(args)),
});

export const allTimeStats = action({
  args: {},
  returns: json,
  handler: async () => callAgentPhoneSdk("webhooks", "allTimeStats"),
});

export const listStoredConfigs = query({
  args: {},
  returns: v.array(json),
  handler: async (ctx) => {
    const configs = await ctx.db.query("webhookConfigs").collect();
    return configs.map(({ secret, providerResponse: _providerResponse, ...config }) => ({
      ...config,
      hasSecret: Boolean(secret),
    }));
  },
});

export const listDeliveries = query({
  args: {
    limit: v.optional(v.number()),
    agentId: v.optional(v.string()),
    event: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("received"),
        v.literal("duplicate"),
        v.literal("dispatched"),
        v.literal("failed"),
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

export const verifyAndRecord = action({
  args: {
    rawBody: v.string(),
    signature: v.optional(v.string()),
    timestamp: v.optional(v.string()),
    webhookId: v.string(),
  },
  returns: v.object({
    accepted: v.boolean(),
    duplicate: v.boolean(),
    normalized: v.optional(normalizedWebhookEvent),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    let payload: unknown;
    try {
      payload = parseWebhookBody(args.rawBody);
    } catch (error) {
      return {
        accepted: false,
        duplicate: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    const normalized = normalizeWebhookPayload(payload);
    const secret = await ctx.runQuery(internal.state.getWebhookSecret, {
      agentId: normalized.agentId,
    });
    if (!secret) {
      return {
        accepted: false,
        duplicate: false,
        error: "No AgentPhone webhook secret is configured for this event.",
      };
    }

    const verified = await verifyAgentPhoneSignature({
      rawBody: args.rawBody,
      signature: args.signature,
      timestamp: args.timestamp,
      secret,
    });
    if (!verified) {
      return {
        accepted: false,
        duplicate: false,
        error: "Invalid AgentPhone webhook signature.",
      };
    }

    const recorded = await ctx.runMutation(internal.state.recordWebhookDelivery, {
      webhookId: args.webhookId,
      signature: args.signature,
      timestamp: args.timestamp,
      normalized,
      payload,
    });
    return {
      accepted: true,
      duplicate: recorded.duplicate,
      normalized,
    };
  },
});
