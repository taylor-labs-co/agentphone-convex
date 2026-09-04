import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  deliveryStatusValidator,
  outboundKindValidator,
  outboundStatusValidator,
  sourceValidator,
  subAccountFields,
} from "./validators.js";

export default defineSchema({
  events: defineTable({
    scope: v.string(),
    source: sourceValidator,
    deliveryId: v.optional(v.string()),
    eventType: v.string(),
    channel: v.optional(v.string()),
    timestamp: v.string(),
    receivedAt: v.number(),
    agentId: v.optional(v.string()),
    numberId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    callId: v.optional(v.string()),
    messageId: v.optional(v.string()),
    direction: v.optional(v.string()),
    payload: v.any(),
  })
    .index("by_scope", ["scope"])
    .index("by_scope_and_source", ["scope", "source"])
    .index("by_scope_and_delivery_id", ["scope", "deliveryId"])
    .index("by_scope_and_event_type", ["scope", "eventType"])
    .index("by_scope_and_agent_id", ["scope", "agentId"])
    .index("by_scope_and_number_id", ["scope", "numberId"])
    .index("by_scope_and_conversation_id", ["scope", "conversationId"])
    .index("by_scope_and_call_id", ["scope", "callId"])
    .index("by_scope_and_message_id", ["scope", "messageId"]),

  webhookDeliveries: defineTable({
    scope: v.string(),
    deliveryId: v.string(),
    eventId: v.id("events"),
    eventType: v.string(),
    channel: v.optional(v.string()),
    agentId: v.optional(v.string()),
    callback: v.optional(v.string()),
    status: deliveryStatusValidator,
    attempts: v.number(),
    maxAttempts: v.number(),
    error: v.optional(v.string()),
    nextAttemptAt: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
    receivedAt: v.number(),
    processedAt: v.optional(v.number()),
  })
    .index("by_scope_and_delivery_id", ["scope", "deliveryId"])
    .index("by_scope_and_status", ["scope", "status"])
    .index("by_scope_and_received_at", ["scope", "receivedAt"])
    .index("by_scope_and_agent_id", ["scope", "agentId", "receivedAt"]),

  webhookConfigs: defineTable({
    scope: v.string(),
    secret: v.string(),
    webhookId: v.optional(v.string()),
    url: v.optional(v.string()),
    status: v.optional(v.string()),
    contextLimit: v.optional(v.number()),
    timeout: v.optional(v.number()),
    agentId: v.optional(v.string()),
    subAccountId: v.optional(v.string()),
    createdAt: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_scope", ["scope"]),

  /**
   * Registry of the AgentPhone sub-accounts a master scope owns. Unlike the
   * mirrors below it is also the provisioning ledger: a row is claimed before
   * the create request so one tenant key can only ever own one sub-account.
   */
  subAccounts: defineTable(subAccountFields)
    .index("by_scope_and_sub_account_id", ["scope", "subAccountId"])
    .index("by_scope_and_key", ["scope", "key"]),

  agents: defineTable({
    scope: v.string(),
    agentId: v.string(),
    name: v.optional(v.string()),
    status: v.optional(v.string()),
    payload: v.any(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_scope_and_agent_id", ["scope", "agentId"]),

  numbers: defineTable({
    scope: v.string(),
    numberId: v.string(),
    agentId: v.optional(v.string()),
    phoneNumber: v.optional(v.string()),
    status: v.optional(v.string()),
    payload: v.any(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scope_and_number_id", ["scope", "numberId"])
    .index("by_scope_and_agent_id", ["scope", "agentId"])
    .index("by_scope_and_phone_number", ["scope", "phoneNumber"]),

  conversations: defineTable({
    scope: v.string(),
    conversationId: v.string(),
    agentId: v.optional(v.string()),
    numberId: v.optional(v.string()),
    counterparty: v.optional(v.string()),
    status: v.optional(v.string()),
    lastMessageId: v.optional(v.string()),
    lastMessageText: v.optional(v.string()),
    lastDirection: v.optional(v.string()),
    lastActivityAt: v.optional(v.number()),
    payload: v.any(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scope_and_conversation_id", ["scope", "conversationId"])
    .index("by_scope_and_agent_id", ["scope", "agentId", "lastActivityAt"])
    .index("by_scope_and_number_id", ["scope", "numberId", "lastActivityAt"])
    .index("by_scope_and_counterparty", [
      "scope",
      "counterparty",
      "lastActivityAt",
    ])
    .index("by_scope_and_last_activity_at", ["scope", "lastActivityAt"]),

  messages: defineTable({
    scope: v.string(),
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
    status: v.optional(v.string()),
    timestamp: v.optional(v.number()),
    payload: v.any(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scope_and_message_id", ["scope", "messageId"])
    .index("by_scope_and_conversation_id", [
      "scope",
      "conversationId",
      "timestamp",
    ])
    .index("by_scope_and_agent_id", ["scope", "agentId", "timestamp"])
    .index("by_scope_and_number_id", ["scope", "numberId", "timestamp"])
    .index("by_scope_and_counterparty", ["scope", "counterparty", "timestamp"])
    .index("by_scope_and_call_id", ["scope", "callId", "timestamp"]),

  calls: defineTable({
    scope: v.string(),
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
    payload: v.any(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_scope_and_call_id", ["scope", "callId"])
    .index("by_scope_and_agent_id", ["scope", "agentId", "startedAt"])
    .index("by_scope_and_number_id", ["scope", "numberId", "startedAt"])
    .index("by_scope_and_conversation_id", [
      "scope",
      "conversationId",
      "startedAt",
    ]),

  callTranscripts: defineTable({
    scope: v.string(),
    callId: v.string(),
    payload: v.any(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_scope_and_call_id", ["scope", "callId"]),

  callRecordings: defineTable({
    scope: v.string(),
    callId: v.string(),
    url: v.optional(v.string()),
    payload: v.any(),
    syncedAt: v.number(),
    updatedAt: v.number(),
  }).index("by_scope_and_call_id", ["scope", "callId"]),

  outboundRequests: defineTable({
    scope: v.string(),
    kind: outboundKindValidator,
    status: outboundStatusValidator,
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
    .index("by_scope_and_status", ["scope", "status", "createdAt"])
    .index("by_scope_and_agent_id", ["scope", "agentId", "createdAt"])
    .index("by_scope_and_idempotency_key", ["scope", "idempotencyKey"]),
});
