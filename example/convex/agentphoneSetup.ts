import { v } from "convex/values";

import { AgentPhone } from "@taylor-labs/agentphone-convex";

import { action } from "./_generated/server.js";
import { api, components } from "./_generated/api.js";

const phone = new AgentPhone(components.agentphone);

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
  args: {
    siteUrl: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) =>
    phone.configureProjectWebhook(ctx, {
      url: `${args.siteUrl}/agentphone/webhook`,
      event_types: [
        "agent.message",
        "agent.call_ended",
        "agent.reaction",
      ],
      context_limit: 10,
    }),
});
