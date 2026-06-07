import { v } from "convex/values";

import { AgentPhone } from "agentphone-convex";

import { action } from "./_generated/server.js";
import { api, components } from "./_generated/api.js";

const phone = new AgentPhone(components.agentphone, {
  httpPrefix: "/agentphone",
});

export const registerCallbacks = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await phone.registerCallbacks(ctx, {
      onMessage: api.agentphoneCallbacks.onMessage,
      onVoiceMessage: api.agentphoneCallbacks.onVoiceMessage,
      onCallEnded: api.agentphoneCallbacks.onCallEnded,
      onReaction: api.agentphoneCallbacks.onReaction,
    });
    return null;
  },
});

export const createSupportAgent = action({
  args: {
    name: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) =>
    phone.createAgent(ctx, {
      name: args.name,
      instructions: "Answer questions concisely and escalate when needed.",
    }),
});

export const configureWebhook = action({
  args: {},
  returns: v.any(),
  handler: async (ctx) =>
    phone.ensureProjectWebhook(ctx, {
      eventTypes: ["agent.message", "agent.call_ended", "agent.reaction"],
      contextLimit: 10,
    }),
});

export const enqueueWelcomeMessage = action({
  args: {
    agentId: v.string(),
    toNumber: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) =>
    phone.enqueueMessage(ctx, {
      agent_id: args.agentId,
      to_number: args.toNumber,
      body: "Hello from AgentPhone + Convex.",
      idempotency_key: `welcome:${args.agentId}:${args.toNumber}`,
    }),
});
