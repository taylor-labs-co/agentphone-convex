import type { NamedTableInfo, Query, WithoutSystemFields } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api.js";
import { internalMutation, query } from "./_generated/server.js";
import type { DataModel, Doc } from "./_generated/dataModel.js";
import { eventCallbackValidator, recordDelivery } from "./deliveries.js";
import schema from "./schema.js";
import { agentPhoneEventValidator, sourceValidator } from "./validators.js";

export type StoredEvent = WithoutSystemFields<Doc<"events">>;
type WebhookEvent = typeof agentPhoneEventValidator.type;

const listArgs = {
  scope: v.string(),
  limit: v.optional(v.number()),
};

export const insertWebhook = internalMutation({
  args: {
    scope: v.string(),
    deliveryId: v.string(),
    payload: agentPhoneEventValidator,
    callback: v.optional(eventCallbackValidator),
  },
  returns: v.object({
    duplicate: v.boolean(),
    event: schema.tables.events.validator,
    callbackResult: v.any(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("events")
      .withIndex("by_scope_and_delivery_id", (q) =>
        q.eq("scope", args.scope).eq("deliveryId", args.deliveryId),
      )
      .first();
    if (existing) {
      return {
        duplicate: true,
        event: withoutSystemFields(existing),
        callbackResult: null,
      };
    }

    const event = toStoredWebhookEvent(
      args.scope,
      args.deliveryId,
      args.payload,
    );
    const eventId = await ctx.db.insert("events", event);
    await ctx.runMutation(internal.resources.upsertFromWebhook, {
      scope: args.scope,
      deliveryId: args.deliveryId,
      receivedAt: event.receivedAt,
      event: args.payload,
    });
    const callbackResult = await recordDelivery(ctx, {
      scope: args.scope,
      deliveryId: args.deliveryId,
      eventId,
      event: args.payload,
      callback: args.callback,
    });
    return { duplicate: false, event, callbackResult };
  },
});

export const recordApiEvent = internalMutation({
  args: {
    scope: v.string(),
    eventType: v.string(),
    channel: v.optional(v.string()),
    agentId: v.optional(v.string()),
    numberId: v.optional(v.string()),
    conversationId: v.optional(v.string()),
    callId: v.optional(v.string()),
    messageId: v.optional(v.string()),
    direction: v.optional(v.string()),
    payload: v.any(),
  },
  returns: schema.tables.events.validator,
  handler: async (ctx, args) => {
    const event: StoredEvent = {
      scope: args.scope,
      source: "api",
      eventType: args.eventType,
      timestamp: new Date().toISOString(),
      receivedAt: Date.now(),
      payload: args.payload,
      ...(args.channel && { channel: args.channel }),
      ...(args.agentId && { agentId: args.agentId }),
      ...(args.numberId && { numberId: args.numberId }),
      ...(args.conversationId && { conversationId: args.conversationId }),
      ...(args.callId && { callId: args.callId }),
      ...(args.messageId && { messageId: args.messageId }),
      ...(args.direction && { direction: args.direction }),
    };
    await ctx.db.insert("events", event);
    return event;
  },
});

export const list = query({
  args: listArgs,
  returns: v.array(schema.tables.events.validator),
  handler: async (ctx, args) => {
    return await takeEvents(
      ctx.db
        .query("events")
        .withIndex("by_scope", (q) => q.eq("scope", args.scope)),
      args.limit,
    );
  },
});

export const listBySource = query({
  args: { ...listArgs, source: sourceValidator },
  returns: v.array(schema.tables.events.validator),
  handler: async (ctx, args) => {
    return await takeEvents(
      ctx.db
        .query("events")
        .withIndex("by_scope_and_source", (q) =>
          q.eq("scope", args.scope).eq("source", args.source),
        ),
      args.limit,
    );
  },
});

export const listByType = query({
  args: { ...listArgs, eventType: v.string() },
  returns: v.array(schema.tables.events.validator),
  handler: async (ctx, args) => {
    return await takeEvents(
      ctx.db
        .query("events")
        .withIndex("by_scope_and_event_type", (q) =>
          q.eq("scope", args.scope).eq("eventType", args.eventType),
        ),
      args.limit,
    );
  },
});

export const listByAgent = query({
  args: { ...listArgs, agentId: v.string() },
  returns: v.array(schema.tables.events.validator),
  handler: async (ctx, args) => {
    return await takeEvents(
      ctx.db
        .query("events")
        .withIndex("by_scope_and_agent_id", (q) =>
          q.eq("scope", args.scope).eq("agentId", args.agentId),
        ),
      args.limit,
    );
  },
});

export const listByNumber = query({
  args: { ...listArgs, numberId: v.string() },
  returns: v.array(schema.tables.events.validator),
  handler: async (ctx, args) => {
    return await takeEvents(
      ctx.db
        .query("events")
        .withIndex("by_scope_and_number_id", (q) =>
          q.eq("scope", args.scope).eq("numberId", args.numberId),
        ),
      args.limit,
    );
  },
});

export const listByConversation = query({
  args: { ...listArgs, conversationId: v.string() },
  returns: v.array(schema.tables.events.validator),
  handler: async (ctx, args) => {
    return await takeEvents(
      ctx.db
        .query("events")
        .withIndex("by_scope_and_conversation_id", (q) =>
          q.eq("scope", args.scope).eq("conversationId", args.conversationId),
        ),
      args.limit,
    );
  },
});

export const listByCall = query({
  args: { ...listArgs, callId: v.string() },
  returns: v.array(schema.tables.events.validator),
  handler: async (ctx, args) => {
    return await takeEvents(
      ctx.db
        .query("events")
        .withIndex("by_scope_and_call_id", (q) =>
          q.eq("scope", args.scope).eq("callId", args.callId),
        ),
      args.limit,
    );
  },
});

export const getByDeliveryId = query({
  args: { scope: v.string(), deliveryId: v.string() },
  returns: v.union(schema.tables.events.validator, v.null()),
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("events")
      .withIndex("by_scope_and_delivery_id", (q) =>
        q.eq("scope", args.scope).eq("deliveryId", args.deliveryId),
      )
      .first();
    return event ? withoutSystemFields(event) : null;
  },
});

async function takeEvents(
  dbQuery: Query<NamedTableInfo<DataModel, "events">>,
  requestedLimit: number | undefined,
) {
  const limit = normalizeLimit(requestedLimit);
  const events = await dbQuery.order("desc").take(limit);
  return events.map(withoutSystemFields);
}

function normalizeLimit(value: number | undefined) {
  if (value === undefined) {
    return 50;
  }
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("limit must be an integer between 1 and 100");
  }
  return value;
}

function toStoredWebhookEvent(
  scope: string,
  deliveryId: string,
  payload: WebhookEvent,
): StoredEvent {
  const data = asRecord(payload.data);
  return {
    scope,
    source: "webhook",
    deliveryId,
    eventType: payload.event,
    channel: payload.channel,
    timestamp: payload.timestamp,
    receivedAt: Date.now(),
    payload,
    ...(payload.agentId && { agentId: payload.agentId }),
    ...optionalString(data, "numberId"),
    ...optionalString(data, "conversationId"),
    ...optionalString(data, "callId"),
    ...optionalString(data, "messageId"),
    ...optionalString(data, "direction"),
  };
}

function optionalString(
  value: Record<string, unknown>,
  key: "numberId" | "conversationId" | "callId" | "messageId" | "direction",
) {
  return typeof value[key] === "string" ? { [key]: value[key] } : {};
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function withoutSystemFields(doc: Doc<"events">): StoredEvent {
  const { _id, _creationTime, ...event } = doc;
  return event;
}
