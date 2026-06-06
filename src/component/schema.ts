import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const callbackHandles = v.object({
  onMessage: v.optional(v.string()),
  onVoiceMessage: v.optional(v.string()),
  onCallEnded: v.optional(v.string()),
  onReaction: v.optional(v.string()),
});

export default defineSchema({
  callbackConfigs: defineTable({
    key: v.string(),
    handles: callbackHandles,
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),

  webhookConfigs: defineTable({
    scope: v.union(v.literal("project"), v.literal("agent")),
    key: v.string(),
    agentId: v.optional(v.string()),
    providerWebhookId: v.optional(v.string()),
    url: v.string(),
    secret: v.optional(v.string()),
    status: v.optional(v.string()),
    eventTypes: v.optional(v.array(v.string())),
    contextLimit: v.optional(v.number()),
    timeoutMs: v.optional(v.number()),
    providerResponse: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_agent", ["agentId"]),

  webhookDeliveries: defineTable({
    webhookId: v.string(),
    signature: v.optional(v.string()),
    timestamp: v.optional(v.string()),
    event: v.string(),
    channel: v.optional(v.string()),
    agentId: v.optional(v.string()),
    status: v.union(
      v.literal("received"),
      v.literal("duplicate"),
      v.literal("dispatched"),
      v.literal("failed"),
      v.literal("ignored"),
    ),
    callback: v.optional(
      v.union(
        v.literal("onMessage"),
        v.literal("onVoiceMessage"),
        v.literal("onCallEnded"),
        v.literal("onReaction"),
      ),
    ),
    error: v.optional(v.string()),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_webhookId", ["webhookId"])
    .index("by_agent", ["agentId", "receivedAt"])
    .index("by_event", ["event", "receivedAt"])
    .index("by_status", ["status", "receivedAt"])
    .index("by_receivedAt", ["receivedAt"]),

  webhookEvents: defineTable({
    webhookId: v.string(),
    event: v.string(),
    channel: v.optional(v.string()),
    agentId: v.optional(v.string()),
    callback: v.optional(
      v.union(
        v.literal("onMessage"),
        v.literal("onVoiceMessage"),
        v.literal("onCallEnded"),
        v.literal("onReaction"),
      ),
    ),
    payload: v.any(),
    normalized: v.any(),
    receivedAt: v.number(),
  })
    .index("by_webhookId", ["webhookId"])
    .index("by_agent", ["agentId", "receivedAt"])
    .index("by_event", ["event", "receivedAt"])
    .index("by_channel", ["channel", "receivedAt"])
    .index("by_receivedAt", ["receivedAt"]),
});
