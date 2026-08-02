import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  query,
} from "./_generated/server.js";
import { components, internal } from "./_generated/api.js";
import {
  AgentPhone,
  eventValidator,
  requireAgentPhoneScopeAccess,
  storedEventValidator,
  voiceResponseValidator,
} from "agentphone-convex";

export const agentphone = new AgentPhone(components.agentphone, {
  defaultAgentId: process.env.AGENTPHONE_AGENT_ID,
});
agentphone.incomingMessageCallback = internal.agentphone.handleIncomingEvent;
agentphone.reactionCallback = internal.agentphone.handleIncomingEvent;
agentphone.callEndedCallback = internal.agentphone.handleIncomingEvent;

export const handleIncomingEvent = internalMutation({
  args: { event: eventValidator },
  returns: v.union(voiceResponseValidator, v.null()),
  handler: async (_ctx, args) => {
    console.log("AgentPhone event", args.event.event, args.event.data);
    if (
      args.event.event === "agent.message" &&
      args.event.channel === "voice"
    ) {
      return { text: "Thanks — I received that." };
    }
    return null;
  },
});

export const sendMessage = internalAction({
  args: { toNumber: v.string(), body: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await agentphone.sendMessage(ctx, args);
  },
});

export const queueMessage = internalMutation({
  args: {
    toNumber: v.string(),
    body: v.string(),
    idempotencyKey: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await agentphone.enqueueMessage(ctx, {
      ...args,
      maxAttempts: 3,
    });
  },
});

export const call = internalAction({
  args: { toNumber: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await agentphone.createOutboundCall(ctx, {
      toNumber: args.toNumber,
      initialGreeting: "Hi! This is the AgentPhone Convex example.",
    });
  },
});

export const configureWebhook = internalAction({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    return await agentphone.configureWebhook(ctx, { contextLimit: 10 });
  },
});

export const recentEvents = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(storedEventValidator),
  handler: async (ctx, args) => {
    await requireAgentPhoneScopeAccess(ctx, { scope: agentphone.scope });
    return await agentphone.listEvents(ctx, args);
  },
});

export const conversationState = query({
  args: { conversationId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireAgentPhoneScopeAccess(ctx, { scope: agentphone.scope });
    return await agentphone.getLatestConversationState(ctx, {
      ...args,
      messageLimit: 25,
    });
  },
});

export const syncRecentConversations = internalAction({
  args: { limit: v.optional(v.number()) },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await agentphone.syncConversations(ctx, args);
  },
});
