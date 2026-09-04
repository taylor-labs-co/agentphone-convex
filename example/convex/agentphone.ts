import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  query,
} from "./_generated/server.js";
import { components, internal } from "./_generated/api.js";
import {
  AgentPhone,
  eventCallbackArgs,
  requireAgentPhoneScopeAccess,
  storedEventValidator,
  subAccountValidator,
  voiceResponseValidator,
} from "agentphone-convex";

export const agentphone = new AgentPhone(components.agentphone, {
  defaultAgentId: process.env.AGENTPHONE_AGENT_ID,
});
agentphone.incomingMessageCallback = internal.agentphone.handleIncomingEvent;
agentphone.reactionCallback = internal.agentphone.handleIncomingEvent;
agentphone.callEndedCallback = internal.agentphone.handleIncomingEvent;

export const handleIncomingEvent = internalMutation({
  args: eventCallbackArgs,
  returns: v.union(voiceResponseValidator, v.null()),
  handler: async (_ctx, args) => {
    // `scope` names the tenant the delivery arrived for: the client's own scope
    // for the master account, or a `<scope>:sub:<subAccountId>` tenant scope.
    console.log("AgentPhone event", args.scope, args.event.event);
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

// Multi-tenant provisioning ---------------------------------------------------

/**
 * Give a tenant its own AgentPhone sub-account, phone number, and webhook.
 * Passing the tenant ID as `key` makes the whole action safe to retry: the
 * sub-account is created at most once per tenant.
 */
export const provisionTenant = internalAction({
  args: { tenantId: v.string(), name: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const subAccount = await agentphone.createSubAccount(ctx, {
      name: args.name,
      key: args.tenantId,
    });
    const tenant = agentphone.forSubAccount(subAccount);
    await tenant.configureWebhook(ctx, { contextLimit: 10 });
    const number = await tenant.provisionNumber(ctx, { country: "US" });
    return { subAccountId: subAccount.subAccountId, number };
  },
});

export const textTenantCustomer = internalAction({
  args: { tenantId: v.string(), toNumber: v.string(), body: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    const subAccount = await agentphone.getLocalSubAccount(ctx, {
      key: args.tenantId,
    });
    if (subAccount?.status !== "active" || !subAccount.subAccountId) {
      throw new Error(`Tenant ${args.tenantId} has no AgentPhone sub-account`);
    }
    const tenant = agentphone.forSubAccount(subAccount.subAccountId);
    return await tenant.sendMessage(ctx, {
      toNumber: args.toNumber,
      body: args.body,
    });
  },
});

export const tenantSubAccounts = query({
  args: {},
  returns: v.array(subAccountValidator),
  handler: async (ctx) => {
    await requireAgentPhoneScopeAccess(ctx, { scope: agentphone.scope });
    return await agentphone.listLocalSubAccounts(ctx);
  },
});
