import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server.js";
import { internalMutation, query } from "./_generated/server.js";
import {
  counterpartyFor,
  extractAgentPhoneRecords,
  parseTimestamp,
  providerId,
  resourceSnapshotsFromWebhook,
} from "./lib/resourceState.js";
import schema from "./schema.js";
import { agentPhoneEventValidator } from "./validators.js";

const resourceListArgs = {
  scope: v.string(),
  limit: v.optional(v.number()),
};

export const upsertFromWebhook = internalMutation({
  args: {
    scope: v.string(),
    deliveryId: v.string(),
    receivedAt: v.number(),
    event: agentPhoneEventValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const snapshots = resourceSnapshotsFromWebhook(args);
    if (snapshots.agent) {
      await upsertAgent(ctx, args.scope, snapshots.agent);
    }
    if (snapshots.number) {
      await upsertNumber(ctx, args.scope, snapshots.number);
    }
    if (snapshots.conversation) {
      await upsertConversation(ctx, args.scope, snapshots.conversation);
    }
    if (snapshots.message) {
      await upsertMessage(ctx, args.scope, snapshots.message);
    }
    if (snapshots.call) {
      await upsertCall(ctx, args.scope, snapshots.call);
    }
    return null;
  },
});

export const upsertAgentsFromResponse = internalMutation({
  args: { scope: v.string(), response: v.any() },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    for (const record of extractAgentPhoneRecords(args.response)) {
      if (await upsertAgent(ctx, args.scope, normalizeAgent(record))) {
        count += 1;
      }
    }
    return count;
  },
});

export const upsertNumbersFromResponse = internalMutation({
  args: { scope: v.string(), response: v.any() },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    for (const record of extractAgentPhoneRecords(args.response)) {
      if (await upsertNumber(ctx, args.scope, normalizeNumber(record))) {
        count += 1;
      }
    }
    return count;
  },
});

export const upsertConversationsFromResponse = internalMutation({
  args: { scope: v.string(), response: v.any() },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    for (const record of extractAgentPhoneRecords(args.response)) {
      if (
        await upsertConversation(ctx, args.scope, normalizeConversation(record))
      ) {
        count += 1;
      }
    }
    return count;
  },
});

export const upsertMessagesFromResponse = internalMutation({
  args: { scope: v.string(), response: v.any() },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    for (const record of extractAgentPhoneRecords(args.response)) {
      if (await upsertMessage(ctx, args.scope, normalizeMessage(record))) {
        count += 1;
      }
    }
    return count;
  },
});

export const upsertCallsFromResponse = internalMutation({
  args: { scope: v.string(), response: v.any() },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    for (const record of extractAgentPhoneRecords(args.response)) {
      if (await upsertCall(ctx, args.scope, normalizeCall(record))) {
        count += 1;
      }
    }
    return count;
  },
});

export const upsertCallTranscript = internalMutation({
  args: { scope: v.string(), callId: v.string(), response: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("callTranscripts")
      .withIndex("by_scope_and_call_id", (q) =>
        q.eq("scope", args.scope).eq("callId", args.callId),
      )
      .unique();
    const value = {
      scope: args.scope,
      callId: args.callId,
      payload: args.response,
      syncedAt: now,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.replace("callTranscripts", existing._id, value);
    } else {
      await ctx.db.insert("callTranscripts", value);
    }
    return null;
  },
});

export const upsertCallRecording = internalMutation({
  args: { scope: v.string(), callId: v.string(), response: v.any() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const record = asRecord(args.response);
    const existing = await ctx.db
      .query("callRecordings")
      .withIndex("by_scope_and_call_id", (q) =>
        q.eq("scope", args.scope).eq("callId", args.callId),
      )
      .unique();
    const value = stripUndefined({
      scope: args.scope,
      callId: args.callId,
      url:
        asString(record.url) ??
        asString(record.recordingUrl) ??
        asString(record.recording_url),
      payload: args.response,
      syncedAt: now,
      updatedAt: now,
    });
    if (existing) {
      await ctx.db.replace("callRecordings", existing._id, value);
    } else {
      await ctx.db.insert("callRecordings", value);
    }
    return null;
  },
});

export const listAgents = query({
  args: resourceListArgs,
  returns: v.array(schema.tables.agents.validator),
  handler: async (ctx, args) =>
    withoutSystemFields(
      await ctx.db
        .query("agents")
        .withIndex("by_scope_and_agent_id", (q) => q.eq("scope", args.scope))
        .take(normalizeLimit(args.limit)),
    ),
});

export const getAgent = query({
  args: { scope: v.string(), agentId: v.string() },
  returns: v.union(schema.tables.agents.validator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("agents")
      .withIndex("by_scope_and_agent_id", (q) =>
        q.eq("scope", args.scope).eq("agentId", args.agentId),
      )
      .unique();
    return row ? withoutSystemFields([row])[0] : null;
  },
});

export const listNumbers = query({
  args: resourceListArgs,
  returns: v.array(schema.tables.numbers.validator),
  handler: async (ctx, args) =>
    withoutSystemFields(
      await ctx.db
        .query("numbers")
        .withIndex("by_scope_and_number_id", (q) => q.eq("scope", args.scope))
        .take(normalizeLimit(args.limit)),
    ),
});

export const getNumber = query({
  args: { scope: v.string(), numberId: v.string() },
  returns: v.union(schema.tables.numbers.validator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("numbers")
      .withIndex("by_scope_and_number_id", (q) =>
        q.eq("scope", args.scope).eq("numberId", args.numberId),
      )
      .unique();
    return row ? withoutSystemFields([row])[0] : null;
  },
});

export const listConversations = query({
  args: {
    ...resourceListArgs,
    agentId: v.optional(v.string()),
    numberId: v.optional(v.string()),
    counterparty: v.optional(v.string()),
  },
  returns: v.array(schema.tables.conversations.validator),
  handler: async (ctx, args) => {
    const limit = normalizeLimit(args.limit);
    if (args.agentId) {
      return withoutSystemFields(
        await ctx.db
          .query("conversations")
          .withIndex("by_scope_and_agent_id", (q) =>
            q.eq("scope", args.scope).eq("agentId", args.agentId),
          )
          .order("desc")
          .take(limit),
      );
    }
    if (args.numberId) {
      return withoutSystemFields(
        await ctx.db
          .query("conversations")
          .withIndex("by_scope_and_number_id", (q) =>
            q.eq("scope", args.scope).eq("numberId", args.numberId),
          )
          .order("desc")
          .take(limit),
      );
    }
    if (args.counterparty) {
      return withoutSystemFields(
        await ctx.db
          .query("conversations")
          .withIndex("by_scope_and_counterparty", (q) =>
            q.eq("scope", args.scope).eq("counterparty", args.counterparty),
          )
          .order("desc")
          .take(limit),
      );
    }
    return withoutSystemFields(
      await ctx.db
        .query("conversations")
        .withIndex("by_scope_and_last_activity_at", (q) =>
          q.eq("scope", args.scope),
        )
        .order("desc")
        .take(limit),
    );
  },
});

export const getConversation = query({
  args: { scope: v.string(), conversationId: v.string() },
  returns: v.union(schema.tables.conversations.validator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("conversations")
      .withIndex("by_scope_and_conversation_id", (q) =>
        q.eq("scope", args.scope).eq("conversationId", args.conversationId),
      )
      .unique();
    return row ? withoutSystemFields([row])[0] : null;
  },
});

export const listMessagesByConversation = query({
  args: { ...resourceListArgs, conversationId: v.string() },
  returns: v.array(schema.tables.messages.validator),
  handler: async (ctx, args) =>
    withoutSystemFields(
      await ctx.db
        .query("messages")
        .withIndex("by_scope_and_conversation_id", (q) =>
          q.eq("scope", args.scope).eq("conversationId", args.conversationId),
        )
        .order("desc")
        .take(normalizeLimit(args.limit)),
    ),
});

export const listMessagesByAgent = query({
  args: { ...resourceListArgs, agentId: v.string() },
  returns: v.array(schema.tables.messages.validator),
  handler: async (ctx, args) =>
    withoutSystemFields(
      await ctx.db
        .query("messages")
        .withIndex("by_scope_and_agent_id", (q) =>
          q.eq("scope", args.scope).eq("agentId", args.agentId),
        )
        .order("desc")
        .take(normalizeLimit(args.limit)),
    ),
});

export const listMessagesByNumber = query({
  args: { ...resourceListArgs, numberId: v.string() },
  returns: v.array(schema.tables.messages.validator),
  handler: async (ctx, args) =>
    withoutSystemFields(
      await ctx.db
        .query("messages")
        .withIndex("by_scope_and_number_id", (q) =>
          q.eq("scope", args.scope).eq("numberId", args.numberId),
        )
        .order("desc")
        .take(normalizeLimit(args.limit)),
    ),
});

export const listMessagesByCounterparty = query({
  args: { ...resourceListArgs, counterparty: v.string() },
  returns: v.array(schema.tables.messages.validator),
  handler: async (ctx, args) =>
    withoutSystemFields(
      await ctx.db
        .query("messages")
        .withIndex("by_scope_and_counterparty", (q) =>
          q.eq("scope", args.scope).eq("counterparty", args.counterparty),
        )
        .order("desc")
        .take(normalizeLimit(args.limit)),
    ),
});

export const listCallsByAgent = query({
  args: { ...resourceListArgs, agentId: v.string() },
  returns: v.array(schema.tables.calls.validator),
  handler: async (ctx, args) =>
    withoutSystemFields(
      await ctx.db
        .query("calls")
        .withIndex("by_scope_and_agent_id", (q) =>
          q.eq("scope", args.scope).eq("agentId", args.agentId),
        )
        .order("desc")
        .take(normalizeLimit(args.limit)),
    ),
});

export const listCallsByNumber = query({
  args: { ...resourceListArgs, numberId: v.string() },
  returns: v.array(schema.tables.calls.validator),
  handler: async (ctx, args) =>
    withoutSystemFields(
      await ctx.db
        .query("calls")
        .withIndex("by_scope_and_number_id", (q) =>
          q.eq("scope", args.scope).eq("numberId", args.numberId),
        )
        .order("desc")
        .take(normalizeLimit(args.limit)),
    ),
});

export const getLatestConversationState = query({
  args: {
    scope: v.string(),
    conversationId: v.string(),
    messageLimit: v.optional(v.number()),
  },
  returns: v.union(
    v.object({
      conversation: schema.tables.conversations.validator,
      messages: v.array(schema.tables.messages.validator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_scope_and_conversation_id", (q) =>
        q.eq("scope", args.scope).eq("conversationId", args.conversationId),
      )
      .unique();
    if (!conversation) {
      return null;
    }
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_scope_and_conversation_id", (q) =>
        q.eq("scope", args.scope).eq("conversationId", args.conversationId),
      )
      .order("desc")
      .take(normalizeLimit(args.messageLimit ?? 20));
    return {
      conversation: withoutSystemFields([conversation])[0]!,
      messages: withoutSystemFields(messages),
    };
  },
});

export const getCallTranscript = query({
  args: { scope: v.string(), callId: v.string() },
  returns: v.union(schema.tables.callTranscripts.validator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("callTranscripts")
      .withIndex("by_scope_and_call_id", (q) =>
        q.eq("scope", args.scope).eq("callId", args.callId),
      )
      .unique();
    return row ? withoutSystemFields([row])[0] : null;
  },
});

export const getCallRecording = query({
  args: { scope: v.string(), callId: v.string() },
  returns: v.union(schema.tables.callRecordings.validator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("callRecordings")
      .withIndex("by_scope_and_call_id", (q) =>
        q.eq("scope", args.scope).eq("callId", args.callId),
      )
      .unique();
    return row ? withoutSystemFields([row])[0] : null;
  },
});

async function upsertAgent(
  ctx: MutationCtx,
  scope: string,
  record: Record<string, unknown>,
) {
  const agentId = providerId(record, ["agent_id", "agentId", "id"]);
  if (!agentId) return false;
  const now = Date.now();
  const value = stripUndefined({
    scope,
    agentId,
    name: asString(record.name),
    status: asString(record.status),
    payload: record.payload ?? record,
    syncedAt: now,
    updatedAt: now,
  });
  const existing = await ctx.db
    .query("agents")
    .withIndex("by_scope_and_agent_id", (q) =>
      q.eq("scope", scope).eq("agentId", agentId),
    )
    .unique();
  if (existing) await ctx.db.replace("agents", existing._id, value);
  else await ctx.db.insert("agents", value);
  return true;
}

async function upsertNumber(
  ctx: MutationCtx,
  scope: string,
  record: Record<string, unknown>,
) {
  const numberId = providerId(record, ["number_id", "numberId", "id", "sid"]);
  if (!numberId) return false;
  const now = Date.now();
  const value = stripUndefined({
    scope,
    numberId,
    agentId: asString(record.agentId) ?? asString(record.agent_id),
    phoneNumber:
      asString(record.phoneNumber) ??
      asString(record.phone_number) ??
      asString(record.number),
    status: asString(record.status),
    payload: record.payload ?? record,
    syncedAt: now,
    updatedAt: now,
  });
  const existing = await ctx.db
    .query("numbers")
    .withIndex("by_scope_and_number_id", (q) =>
      q.eq("scope", scope).eq("numberId", numberId),
    )
    .unique();
  if (existing) await ctx.db.replace("numbers", existing._id, value);
  else await ctx.db.insert("numbers", value);
  return true;
}

async function upsertConversation(
  ctx: MutationCtx,
  scope: string,
  record: Record<string, unknown>,
) {
  const conversationId = providerId(record, [
    "conversation_id",
    "conversationId",
    "id",
  ]);
  if (!conversationId) return false;
  const now = Date.now();
  const value = stripUndefined({
    scope,
    conversationId,
    agentId: asString(record.agentId) ?? asString(record.agent_id),
    numberId: asString(record.numberId) ?? asString(record.number_id),
    counterparty: asString(record.counterparty),
    status: asString(record.status),
    lastMessageId:
      asString(record.lastMessageId) ?? asString(record.last_message_id),
    lastMessageText:
      asString(record.lastMessageText) ?? asString(record.last_message_text),
    lastDirection:
      asString(record.lastDirection) ?? asString(record.last_direction),
    lastActivityAt:
      asNumber(record.lastActivityAt) ??
      parseTimestamp(
        asString(record.last_activity_at) ?? asString(record.updated_at),
      ) ??
      now,
    payload: record.payload ?? record,
    syncedAt: now,
    updatedAt: now,
  });
  const existing = await ctx.db
    .query("conversations")
    .withIndex("by_scope_and_conversation_id", (q) =>
      q.eq("scope", scope).eq("conversationId", conversationId),
    )
    .unique();
  if (existing) await ctx.db.replace("conversations", existing._id, value);
  else await ctx.db.insert("conversations", value);
  return true;
}

async function upsertMessage(
  ctx: MutationCtx,
  scope: string,
  record: Record<string, unknown>,
) {
  const messageId = providerId(record, ["message_id", "messageId", "id"]);
  if (!messageId) return false;
  const now = Date.now();
  const direction = asString(record.direction);
  const from = asString(record.from) ?? asString(record.from_number);
  const to = asString(record.to) ?? asString(record.to_number);
  const value = stripUndefined({
    scope,
    messageId,
    conversationId:
      asString(record.conversationId) ?? asString(record.conversation_id),
    agentId: asString(record.agentId) ?? asString(record.agent_id),
    numberId: asString(record.numberId) ?? asString(record.number_id),
    callId: asString(record.callId) ?? asString(record.call_id),
    channel: asString(record.channel),
    direction,
    from,
    to,
    counterparty:
      asString(record.counterparty) ?? counterpartyFor({ direction, from, to }),
    body:
      asString(record.body) ??
      asString(record.text) ??
      asString(record.message),
    status: asString(record.status),
    timestamp:
      asNumber(record.timestamp) ??
      parseTimestamp(
        asString(record.timestamp) ?? asString(record.created_at),
      ) ??
      now,
    payload: record.payload ?? record,
    syncedAt: now,
    updatedAt: now,
  });
  const existing = await ctx.db
    .query("messages")
    .withIndex("by_scope_and_message_id", (q) =>
      q.eq("scope", scope).eq("messageId", messageId),
    )
    .unique();
  if (existing) await ctx.db.replace("messages", existing._id, value);
  else await ctx.db.insert("messages", value);
  return true;
}

async function upsertCall(
  ctx: MutationCtx,
  scope: string,
  record: Record<string, unknown>,
) {
  const callId = providerId(record, ["call_id", "callId", "id"]);
  if (!callId) return false;
  const now = Date.now();
  const value = stripUndefined({
    scope,
    callId,
    agentId: asString(record.agentId) ?? asString(record.agent_id),
    numberId:
      asString(record.numberId) ??
      asString(record.number_id) ??
      asString(record.phoneNumberId),
    conversationId:
      asString(record.conversationId) ?? asString(record.conversation_id),
    from: asString(record.from) ?? asString(record.fromNumber),
    to: asString(record.to) ?? asString(record.toNumber),
    status: asString(record.status),
    direction: asString(record.direction),
    startedAt:
      asNumber(record.startedAt) ??
      parseTimestamp(asString(record.started_at) ?? asString(record.startedAt)),
    endedAt:
      asNumber(record.endedAt) ??
      parseTimestamp(asString(record.ended_at) ?? asString(record.endedAt)),
    durationSeconds:
      asNumber(record.durationSeconds) ?? asNumber(record.duration_seconds),
    payload: record.payload ?? record,
    syncedAt: now,
    updatedAt: now,
  });
  const existing = await ctx.db
    .query("calls")
    .withIndex("by_scope_and_call_id", (q) =>
      q.eq("scope", scope).eq("callId", callId),
    )
    .unique();
  if (existing) await ctx.db.replace("calls", existing._id, value);
  else await ctx.db.insert("calls", value);
  return true;
}

function normalizeAgent(record: Record<string, unknown>) {
  return {
    ...record,
    agentId: providerId(record, ["agent_id", "agentId", "id"]),
  };
}

function normalizeNumber(record: Record<string, unknown>) {
  return {
    ...record,
    numberId: providerId(record, ["number_id", "numberId", "id", "sid"]),
  };
}

function normalizeConversation(record: Record<string, unknown>) {
  return {
    ...record,
    conversationId: providerId(record, [
      "conversation_id",
      "conversationId",
      "id",
    ]),
  };
}

function normalizeMessage(record: Record<string, unknown>) {
  return {
    ...record,
    messageId: providerId(record, ["message_id", "messageId", "id"]),
  };
}

function normalizeCall(record: Record<string, unknown>) {
  return { ...record, callId: providerId(record, ["call_id", "callId", "id"]) };
}

function withoutSystemFields<T extends { _id: unknown; _creationTime: number }>(
  rows: T[],
) {
  return rows.map(
    ({ _id: _ignoredId, _creationTime: _ignoredTime, ...row }) => row,
  );
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function normalizeLimit(value: number | undefined) {
  if (value === undefined) return 50;
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("limit must be an integer between 1 and 100");
  }
  return value;
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
