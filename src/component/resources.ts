import { internalMutation, query } from "./_generated/server.js";
import { v } from "convex/values";

import {
  extractAgentPhoneRecords,
  providerId,
  resourceSnapshotsFromWebhook,
  parseTimestamp,
  counterpartyFor,
} from "./lib/resourceState.js";
import { json, normalizedWebhookEvent } from "./lib/validators.js";

const resourceListArgs = {
  limit: v.optional(v.number()),
};

export const upsertFromWebhook = internalMutation({
  args: {
    webhookId: v.string(),
    receivedAt: v.number(),
    normalized: normalizedWebhookEvent,
    payload: json,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const snapshots = resourceSnapshotsFromWebhook(args);
    if (snapshots.agent) {
      await upsertAgent(ctx, snapshots.agent);
    }
    if (snapshots.number) {
      await upsertNumber(ctx, snapshots.number);
    }
    if (snapshots.conversation) {
      await upsertConversation(ctx, snapshots.conversation);
    }
    if (snapshots.message) {
      await upsertMessage(ctx, snapshots.message);
    }
    if (snapshots.call) {
      await upsertCall(ctx, snapshots.call);
    }
    return null;
  },
});

export const upsertAgentsFromResponse = internalMutation({
  args: { response: json },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    for (const record of extractAgentPhoneRecords(args.response)) {
      if (await upsertAgent(ctx, normalizeAgent(record))) {
        count += 1;
      }
    }
    return count;
  },
});

export const upsertNumbersFromResponse = internalMutation({
  args: { response: json },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    for (const record of extractAgentPhoneRecords(args.response)) {
      if (await upsertNumber(ctx, normalizeNumber(record))) {
        count += 1;
      }
    }
    return count;
  },
});

export const upsertConversationsFromResponse = internalMutation({
  args: { response: json },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    for (const record of extractAgentPhoneRecords(args.response)) {
      if (await upsertConversation(ctx, normalizeConversation(record))) {
        count += 1;
      }
    }
    return count;
  },
});

export const upsertMessagesFromResponse = internalMutation({
  args: { response: json },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    for (const record of extractAgentPhoneRecords(args.response)) {
      if (await upsertMessage(ctx, normalizeMessage(record))) {
        count += 1;
      }
    }
    return count;
  },
});

export const upsertCallsFromResponse = internalMutation({
  args: { response: json },
  returns: v.number(),
  handler: async (ctx, args) => {
    let count = 0;
    for (const record of extractAgentPhoneRecords(args.response)) {
      if (await upsertCall(ctx, normalizeCall(record))) {
        count += 1;
      }
    }
    return count;
  },
});

export const upsertCallTranscript = internalMutation({
  args: {
    callId: v.string(),
    response: json,
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const record = firstRecord(args.response);
    const transcriptId =
      providerId(record, ["transcript_id", "transcriptId", "id"]) ??
      `call:${args.callId}:latest`;
    const now = Date.now();
    const row = {
      transcriptId,
      callId: args.callId,
      text:
        asString(record.text) ??
        asString(record.transcript) ??
        asString(record.content),
      payload: args.response,
      syncedAt: now,
      updatedAt: now,
    };
    const existing = await ctx.db
      .query("callTranscripts")
      .withIndex("by_transcriptId", (q) => q.eq("transcriptId", transcriptId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, stripUndefined(row));
    } else {
      await ctx.db.insert("callTranscripts", stripUndefined(row));
    }
    return transcriptId;
  },
});

export const upsertCallRecording = internalMutation({
  args: {
    callId: v.string(),
    response: json,
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const record = firstRecord(args.response);
    const recordingId =
      providerId(record, ["recording_id", "recordingId", "id"]) ??
      `call:${args.callId}:latest`;
    const now = Date.now();
    const row = {
      recordingId,
      callId: args.callId,
      url: asString(record.url) ?? asString(record.recording_url),
      payload: args.response,
      syncedAt: now,
      updatedAt: now,
    };
    const existing = await ctx.db
      .query("callRecordings")
      .withIndex("by_recordingId", (q) => q.eq("recordingId", recordingId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, stripUndefined(row));
    } else {
      await ctx.db.insert("callRecordings", stripUndefined(row));
    }
    return recordingId;
  },
});

export const listAgents = query({
  args: resourceListArgs,
  returns: v.array(json),
  handler: async (ctx, args) =>
    stripSystemFields(
      await ctx.db
        .query("agents")
        .withIndex("by_agentId")
        .take(limit(args.limit)),
    ),
});

export const getAgent = query({
  args: { agentId: v.string() },
  returns: v.union(json, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("agents")
      .withIndex("by_agentId", (q) => q.eq("agentId", args.agentId))
      .unique();
    return row ? stripSystemField(row) : null;
  },
});

export const listNumbers = query({
  args: resourceListArgs,
  returns: v.array(json),
  handler: async (ctx, args) =>
    stripSystemFields(
      await ctx.db
        .query("numbers")
        .withIndex("by_numberId")
        .take(limit(args.limit)),
    ),
});

export const getNumber = query({
  args: { numberId: v.string() },
  returns: v.union(json, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("numbers")
      .withIndex("by_numberId", (q) => q.eq("numberId", args.numberId))
      .unique();
    return row ? stripSystemField(row) : null;
  },
});

export const listConversations = query({
  args: {
    agentId: v.optional(v.string()),
    numberId: v.optional(v.string()),
    counterparty: v.optional(v.string()),
    ...resourceListArgs,
  },
  returns: v.array(json),
  handler: async (ctx, args) => {
    if (args.agentId) {
      return stripSystemFields(
        await ctx.db
          .query("conversations")
          .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
          .order("desc")
          .take(limit(args.limit)),
      );
    }
    if (args.numberId) {
      return stripSystemFields(
        await ctx.db
          .query("conversations")
          .withIndex("by_number", (q) => q.eq("numberId", args.numberId))
          .order("desc")
          .take(limit(args.limit)),
      );
    }
    if (args.counterparty) {
      return stripSystemFields(
        await ctx.db
          .query("conversations")
          .withIndex("by_counterparty", (q) =>
            q.eq("counterparty", args.counterparty),
          )
          .order("desc")
          .take(limit(args.limit)),
      );
    }
    return stripSystemFields(
      await ctx.db
        .query("conversations")
        .withIndex("by_lastActivity")
        .order("desc")
        .take(limit(args.limit)),
    );
  },
});

export const getConversation = query({
  args: { conversationId: v.string() },
  returns: v.union(json, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .unique();
    return row ? stripSystemField(row) : null;
  },
});

export const listMessagesByConversation = query({
  args: { conversationId: v.string(), ...resourceListArgs },
  returns: v.array(json),
  handler: async (ctx, args) =>
    stripSystemFields(
      await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) =>
          q.eq("conversationId", args.conversationId),
        )
        .order("desc")
        .take(limit(args.limit)),
    ),
});

export const listMessagesByAgent = query({
  args: { agentId: v.string(), ...resourceListArgs },
  returns: v.array(json),
  handler: async (ctx, args) =>
    stripSystemFields(
      await ctx.db
        .query("messages")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
        .order("desc")
        .take(limit(args.limit)),
    ),
});

export const listMessagesByNumber = query({
  args: { numberId: v.string(), ...resourceListArgs },
  returns: v.array(json),
  handler: async (ctx, args) =>
    stripSystemFields(
      await ctx.db
        .query("messages")
        .withIndex("by_number", (q) => q.eq("numberId", args.numberId))
        .order("desc")
        .take(limit(args.limit)),
    ),
});

export const listMessagesByCounterparty = query({
  args: { counterparty: v.string(), ...resourceListArgs },
  returns: v.array(json),
  handler: async (ctx, args) =>
    stripSystemFields(
      await ctx.db
        .query("messages")
        .withIndex("by_counterparty", (q) =>
          q.eq("counterparty", args.counterparty),
        )
        .order("desc")
        .take(limit(args.limit)),
    ),
});

export const listCallsByAgent = query({
  args: { agentId: v.string(), ...resourceListArgs },
  returns: v.array(json),
  handler: async (ctx, args) =>
    stripSystemFields(
      await ctx.db
        .query("calls")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
        .order("desc")
        .take(limit(args.limit)),
    ),
});

export const listCallsByNumber = query({
  args: { numberId: v.string(), ...resourceListArgs },
  returns: v.array(json),
  handler: async (ctx, args) =>
    stripSystemFields(
      await ctx.db
        .query("calls")
        .withIndex("by_number", (q) => q.eq("numberId", args.numberId))
        .order("desc")
        .take(limit(args.limit)),
    ),
});

export const getLatestConversationState = query({
  args: {
    conversationId: v.string(),
    messageLimit: v.optional(v.number()),
  },
  returns: v.union(json, v.null()),
  handler: async (ctx, args) => {
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_conversationId", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .unique();
    if (!conversation) {
      return null;
    }
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId),
      )
      .order("desc")
      .take(limit(args.messageLimit ?? 20));
    return {
      conversation: stripSystemField(conversation),
      messages: stripSystemFields(messages),
    };
  },
});

export const getCallTranscript = query({
  args: { callId: v.string() },
  returns: v.union(json, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("callTranscripts")
      .withIndex("by_call", (q) => q.eq("callId", args.callId))
      .first();
    return row ? stripSystemField(row) : null;
  },
});

export const getCallRecording = query({
  args: { callId: v.string() },
  returns: v.union(json, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("callRecordings")
      .withIndex("by_call", (q) => q.eq("callId", args.callId))
      .first();
    return row ? stripSystemField(row) : null;
  },
});

async function upsertAgent(ctx: any, record: Record<string, unknown>) {
  const agentId = record.agentId ?? providerId(record, ["agent_id", "agentId", "id"]);
  if (typeof agentId !== "string") {
    return false;
  }
  const now = Date.now();
  const row = {
    agentId,
    name: asString(record.name),
    status: asString(record.status),
    metadata: record.metadata,
    payload: record.payload ?? record,
    syncedAt: now,
    updatedAt: now,
  };
  const existing = await ctx.db
    .query("agents")
    .withIndex("by_agentId", (q: any) => q.eq("agentId", agentId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, stripUndefined(row));
  } else {
    await ctx.db.insert("agents", stripUndefined(row));
  }
  return true;
}

async function upsertNumber(ctx: any, record: Record<string, unknown>) {
  const numberId =
    record.numberId ?? providerId(record, ["number_id", "numberId", "id", "sid"]);
  if (typeof numberId !== "string") {
    return false;
  }
  const now = Date.now();
  const row = {
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
  };
  const existing = await ctx.db
    .query("numbers")
    .withIndex("by_numberId", (q: any) => q.eq("numberId", numberId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, stripUndefined(row));
  } else {
    await ctx.db.insert("numbers", stripUndefined(row));
  }
  return true;
}

async function upsertConversation(ctx: any, record: Record<string, unknown>) {
  const conversationId =
    record.conversationId ??
    providerId(record, ["conversation_id", "conversationId", "id"]);
  if (typeof conversationId !== "string") {
    return false;
  }
  const now = Date.now();
  const lastActivityAt =
    asNumber(record.lastActivityAt) ??
    parseTimestamp(asString(record.last_activity_at) ?? asString(record.updated_at)) ??
    now;
  const row = {
    conversationId,
    agentId: asString(record.agentId) ?? asString(record.agent_id),
    numberId: asString(record.numberId) ?? asString(record.number_id),
    counterparty: asString(record.counterparty),
    status: asString(record.status),
    archived: asBoolean(record.archived),
    labels: asStringArray(record.labels ?? record.tags),
    metadata: record.metadata,
    lastMessageId:
      asString(record.lastMessageId) ?? asString(record.last_message_id),
    lastMessageText:
      asString(record.lastMessageText) ?? asString(record.last_message_text),
    lastDirection: asString(record.lastDirection),
    lastActivityAt,
    payload: record.payload ?? record,
    syncedAt: now,
    updatedAt: now,
  };
  const existing = await ctx.db
    .query("conversations")
    .withIndex("by_conversationId", (q: any) =>
      q.eq("conversationId", conversationId),
    )
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, stripUndefined(row));
  } else {
    await ctx.db.insert("conversations", stripUndefined(row));
  }
  return true;
}

async function upsertMessage(ctx: any, record: Record<string, unknown>) {
  const messageId =
    record.messageId ?? providerId(record, ["message_id", "messageId", "id"]);
  if (typeof messageId !== "string") {
    return false;
  }
  const now = Date.now();
  const direction = asString(record.direction);
  const from = asString(record.from);
  const to = asString(record.to);
  const row = {
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
    counterparty: asString(record.counterparty) ?? counterpartyFor({ direction, from, to }),
    body: asString(record.body),
    text: asString(record.text) ?? asString(record.body),
    status: asString(record.status),
    timestamp:
      asNumber(record.timestamp) ??
      parseTimestamp(asString(record.timestamp) ?? asString(record.created_at)) ??
      now,
    metadata: record.metadata,
    payload: record.payload ?? record,
    syncedAt: now,
    updatedAt: now,
  };
  const existing = await ctx.db
    .query("messages")
    .withIndex("by_messageId", (q: any) => q.eq("messageId", messageId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, stripUndefined(row));
  } else {
    await ctx.db.insert("messages", stripUndefined(row));
  }
  return true;
}

async function upsertCall(ctx: any, record: Record<string, unknown>) {
  const callId = record.callId ?? providerId(record, ["call_id", "callId", "id"]);
  if (typeof callId !== "string") {
    return false;
  }
  const now = Date.now();
  const row = {
    callId,
    agentId: asString(record.agentId) ?? asString(record.agent_id),
    numberId: asString(record.numberId) ?? asString(record.number_id),
    conversationId:
      asString(record.conversationId) ?? asString(record.conversation_id),
    from: asString(record.from),
    to: asString(record.to),
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
    metadata: record.metadata,
    payload: record.payload ?? record,
    syncedAt: now,
    updatedAt: now,
  };
  const existing = await ctx.db
    .query("calls")
    .withIndex("by_callId", (q: any) => q.eq("callId", callId))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, stripUndefined(row));
  } else {
    await ctx.db.insert("calls", stripUndefined(row));
  }
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
  return {
    ...record,
    callId: providerId(record, ["call_id", "callId", "id"]),
  };
}

function firstRecord(response: unknown) {
  return extractAgentPhoneRecords(response)[0] ?? {};
}

function stripSystemFields(rows: Array<Record<string, unknown>>) {
  return rows.map(stripSystemField);
}

function stripSystemField(row: Record<string, unknown>) {
  const { _id, _creationTime, ...rest } = row;
  return rest;
}

function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function limit(value: number | undefined) {
  return Math.min(value ?? 50, 200);
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : undefined;
}
