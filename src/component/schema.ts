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
    agentId: v.optional(v.string()),
    handles: callbackHandles,
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_agent", ["agentId"]),

  agents: defineTable({
    agentId: v.string(),
    name: v.optional(v.string()),
    status: v.optional(v.string()),
    metadata: v.optional(v.any()),
    payload: v.any(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_agentId", ["agentId"]),

  numbers: defineTable({
    numberId: v.string(),
    agentId: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    status: v.optional(v.string()),
    payload: v.any(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_numberId", ["numberId"])
    .index("by_agent", ["agentId"])
    .index("by_phoneNumber", ["phoneNumber"]),

  conversations: defineTable({
    conversationId: v.string(),
    agentId: v.optional(v.string()),
    numberId: v.optional(v.string()),
    counterparty: v.optional(v.string()),
    status: v.optional(v.string()),
    archived: v.optional(v.boolean()),
    labels: v.optional(v.array(v.string())),
    metadata: v.optional(v.any()),
    lastMessageId: v.optional(v.string()),
    lastMessageText: v.optional(v.string()),
    lastDirection: v.optional(v.string()),
    lastActivityAt: v.optional(v.number()),
    payload: v.any(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_conversationId", ["conversationId"])
    .index("by_agent", ["agentId", "lastActivityAt"])
    .index("by_number", ["numberId", "lastActivityAt"])
    .index("by_counterparty", ["counterparty", "lastActivityAt"])
    .index("by_lastActivity", ["lastActivityAt"]),

  messages: defineTable({
    messageId: v.string(),
    conversationId: v.optional(v.string()),
    agentId: v.optional(v.string()),
    numberId: v.optional(v.string()),
    callId: v.optional(v.string()),
    channel: v.optional(v.string()),
    direction: v.optional(v.string()),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    counterparty: v.optional(v.string()),
    body: v.optional(v.string()),
    text: v.optional(v.string()),
    status: v.optional(v.string()),
    timestamp: v.optional(v.number()),
    metadata: v.optional(v.any()),
    payload: v.any(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_messageId", ["messageId"])
    .index("by_conversation", ["conversationId", "timestamp"])
    .index("by_agent", ["agentId", "timestamp"])
    .index("by_number", ["numberId", "timestamp"])
    .index("by_counterparty", ["counterparty", "timestamp"])
    .index("by_call", ["callId", "timestamp"]),

  calls: defineTable({
    callId: v.string(),
    agentId: v.optional(v.string()),
    numberId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    from: v.optional(v.string()),
    to: v.optional(v.string()),
    status: v.optional(v.string()),
    direction: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    durationSeconds: v.optional(v.number()),
    metadata: v.optional(v.any()),
    payload: v.any(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_callId", ["callId"])
    .index("by_agent", ["agentId", "startedAt"])
    .index("by_number", ["numberId", "startedAt"])
    .index("by_conversation", ["conversationId", "startedAt"]),

  callTranscripts: defineTable({
    transcriptId: v.string(),
    callId: v.string(),
    text: v.optional(v.string()),
    payload: v.any(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_transcriptId", ["transcriptId"])
    .index("by_call", ["callId"]),

  callRecordings: defineTable({
    recordingId: v.string(),
    callId: v.string(),
    url: v.optional(v.string()),
    payload: v.any(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_recordingId", ["recordingId"])
    .index("by_call", ["callId"]),

  outboundRequests: defineTable({
    kind: v.union(
      v.literal("message"),
      v.literal("outboundCall"),
      v.literal("webCall"),
    ),
    status: v.union(
      v.literal("queued"),
      v.literal("sending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("cancelled"),
    ),
    args: v.any(),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
    idempotencyKey: v.optional(v.string()),
    agentId: v.optional(v.string()),
    numberId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    messageId: v.optional(v.string()),
    callId: v.optional(v.string()),
    attempts: v.number(),
    maxAttempts: v.number(),
    nextAttemptAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status", "createdAt"])
    .index("by_agent", ["agentId", "createdAt"])
    .index("by_idempotencyKey", ["idempotencyKey"]),

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
      v.literal("retrying"),
      v.literal("dispatched"),
      v.literal("failed"),
      v.literal("dead_letter"),
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
    attempts: v.optional(v.number()),
    maxAttempts: v.optional(v.number()),
    nextAttemptAt: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
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
