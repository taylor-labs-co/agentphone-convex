import { action, internalAction, mutation, query } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";
import type { FunctionHandle } from "convex/server";

import { callAgentPhoneSdk } from "./lib/sdk.js";
import {
  extractWebhookSecret,
  normalizeWebhookPayload,
  parseWebhookBody,
  redactedWebhookConfig,
} from "./lib/webhookPayload.js";
import {
  nextWebhookRetryDelayMs,
  shouldRetryWebhookDispatch,
} from "./lib/webhookDispatch.js";
import { verifyAgentPhoneSignature } from "./lib/webhookSecurity.js";
import {
  json,
  normalizedWebhookEvent,
  paginationArgs,
  stripUndefined,
  webhookCallbackHandles,
} from "./lib/validators.js";

const CALLBACK_KEY = "default";
const DEFAULT_HTTP_PREFIX = "/agentphone";
const DEFAULT_WEBHOOK_EVENTS = [
  "agent.message",
  "agent.call_ended",
  "agent.reaction",
];

const deliveryStatus = v.union(
  v.literal("received"),
  v.literal("duplicate"),
  v.literal("retrying"),
  v.literal("dispatched"),
  v.literal("failed"),
  v.literal("dead_letter"),
  v.literal("ignored"),
);

function callbackKey(agentId: string | undefined) {
  return agentId ? `agent:${agentId}` : CALLBACK_KEY;
}

export const registerCallbacks = mutation({
  args: {
    agent_id: v.optional(v.string()),
    callbacks: webhookCallbackHandles,
  },
  returns: v.object({
    key: v.string(),
    callbacks: webhookCallbackHandles,
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    const key = callbackKey(args.agent_id);
    const existing = await ctx.db
      .query("callbackConfigs")
      .withIndex("by_key", (q) => q.eq("key", key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        agentId: args.agent_id,
        handles: args.callbacks,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("callbackConfigs", {
        key,
        agentId: args.agent_id,
        handles: args.callbacks,
        createdAt: now,
        updatedAt: now,
      });
    }
    return { key, callbacks: args.callbacks };
  },
});

export const getCallbacks = query({
  args: {
    agent_id: v.optional(v.string()),
  },
  returns: webhookCallbackHandles,
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("callbackConfigs")
      .withIndex("by_key", (q) => q.eq("key", callbackKey(args.agent_id)))
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

export const ensureProjectWebhook = action({
  args: {
    url: v.optional(v.string()),
    event_types: v.optional(v.array(v.string())),
    context_limit: v.optional(v.number()),
    timeout_ms: v.optional(v.number()),
    http_prefix: v.optional(v.string()),
  },
  returns: json,
  handler: async (ctx, args) => {
    const siteUrl = process.env.CONVEX_SITE_URL;
    const url =
      args.url ??
      (siteUrl
        ? `${siteUrl}${args.http_prefix ?? DEFAULT_HTTP_PREFIX}/webhook`
        : undefined);
    if (!url) {
      throw new Error(
        "ensureProjectWebhook requires url or CONVEX_SITE_URL in the Convex environment.",
      );
    }
    const eventTypes = args.event_types ?? DEFAULT_WEBHOOK_EVENTS;
    const response = await callAgentPhoneSdk(
      "webhooks",
      "createOrUpdateWebhook",
      stripUndefined({
        url,
        event_types: eventTypes,
        context_limit: args.context_limit,
        timeout_ms: args.timeout_ms,
      }),
    );
    await ctx.runMutation(internal.state.upsertWebhookConfig, {
      scope: "project",
      url,
      secret: extractWebhookSecret(response),
      eventTypes,
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
    status: v.optional(deliveryStatus),
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

export const listFailedDeliveries = query({
  args: {
    limit: v.optional(v.number()),
    agentId: v.optional(v.string()),
  },
  returns: v.array(json),
  handler: async (ctx, args) => {
    const max = Math.min(args.limit ?? 50, 200);
    const failed = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .order("desc")
      .take(max);
    const deadLetters = await ctx.db
      .query("webhookDeliveries")
      .withIndex("by_status", (q) => q.eq("status", "dead_letter"))
      .order("desc")
      .take(max);
    return [...failed, ...deadLetters]
      .filter((row) => !args.agentId || row.agentId === args.agentId)
      .sort((a, b) => b.receivedAt - a.receivedAt)
      .slice(0, max);
  },
});

export const cleanupDeliveries = action({
  args: {
    olderThanMs: v.optional(v.number()),
    statuses: v.optional(v.array(deliveryStatus)),
  },
  returns: json,
  handler: async (ctx, args) => {
    const olderThan = Date.now() - (args.olderThanMs ?? 7 * 24 * 60 * 60 * 1000);
    return ctx.runMutation(internal.state.cleanupWebhookDeliveries, {
      olderThan,
      statuses: args.statuses,
    });
  },
});

export const replayDelivery = action({
  args: {
    webhookId: v.string(),
  },
  returns: json,
  handler: async (ctx, args) => {
    const event = (await ctx.runQuery(internal.state.getWebhookEvent, args)) as
      | { normalized?: unknown }
      | null;
    if (!event?.normalized) {
      return { replayed: false, error: "Webhook event not found." };
    }
    await ctx.runMutation(internal.state.markWebhookDelivery, {
      webhookId: args.webhookId,
      status: "received",
      attempts: 0,
      error: undefined,
    });
    await ctx.scheduler.runAfter(0, internal.webhooks.dispatchCallback, {
      webhookId: args.webhookId,
      normalized: event.normalized,
      attempt: 1,
    });
    return { replayed: true };
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
    if (!recorded.duplicate) {
      await ctx.runMutation(internal.resources.upsertFromWebhook, {
        webhookId: args.webhookId,
        receivedAt: Date.now(),
        normalized,
        payload,
      });
    }
    return {
      accepted: true,
      duplicate: recorded.duplicate,
      normalized,
    };
  },
});

export const dispatchCallback = internalAction({
  args: {
    webhookId: v.string(),
    normalized: normalizedWebhookEvent,
    attempt: v.optional(v.number()),
    maxAttempts: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const callback = args.normalized.callback;
    if (!callback) {
      await ctx.runMutation(internal.state.markWebhookDelivery, {
        webhookId: args.webhookId,
        status: "ignored",
      });
      return null;
    }
    const handle = await ctx.runQuery(internal.state.getCallbackHandle, {
      agentId: args.normalized.agentId,
      callback,
    });
    if (!handle) {
      await ctx.runMutation(internal.state.markWebhookDelivery, {
        webhookId: args.webhookId,
        status: "ignored",
      });
      return null;
    }

    const attempt = args.attempt ?? 1;
    const maxAttempts = args.maxAttempts ?? 3;
    try {
      await ctx.runAction(handle as FunctionHandle<"action">, args.normalized);
      await ctx.runMutation(internal.state.markWebhookDelivery, {
        webhookId: args.webhookId,
        status: "dispatched",
        attempts: attempt,
        maxAttempts,
        lastAttemptAt: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (shouldRetryWebhookDispatch({ attempt, maxAttempts })) {
        const delay = nextWebhookRetryDelayMs(attempt);
        await ctx.runMutation(internal.state.markWebhookDelivery, {
          webhookId: args.webhookId,
          status: "retrying",
          attempts: attempt,
          maxAttempts,
          error: message,
          nextAttemptAt: Date.now() + delay,
          lastAttemptAt: Date.now(),
        });
        await ctx.scheduler.runAfter(delay, internal.webhooks.dispatchCallback, {
          webhookId: args.webhookId,
          normalized: args.normalized,
          attempt: attempt + 1,
          maxAttempts,
        });
      } else {
        await ctx.runMutation(internal.state.markWebhookDelivery, {
          webhookId: args.webhookId,
          status: "dead_letter",
          attempts: attempt,
          maxAttempts,
          error: message,
          lastAttemptAt: Date.now(),
        });
      }
    }
    return null;
  },
});
