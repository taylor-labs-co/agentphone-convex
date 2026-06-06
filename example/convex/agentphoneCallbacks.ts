import { v } from "convex/values";

import { action } from "./_generated/server.js";

const webhookEvent = v.object({
  event: v.string(),
  channel: v.optional(v.string()),
  callback: v.optional(v.string()),
  agentId: v.optional(v.string()),
  conversationId: v.optional(v.string()),
  callId: v.optional(v.string()),
  numberId: v.optional(v.string()),
  messageId: v.optional(v.string()),
  text: v.optional(v.string()),
  from: v.optional(v.string()),
  to: v.optional(v.string()),
  direction: v.optional(v.string()),
  timestamp: v.optional(v.string()),
  payload: v.any(),
});

export const onMessage = action({
  args: webhookEvent.fields,
  returns: v.null(),
  handler: async (_ctx, event) => {
    console.log("AgentPhone message", event);
    return null;
  },
});

export const onVoiceMessage = action({
  args: webhookEvent.fields,
  returns: v.any(),
  handler: async (_ctx, event) => {
    console.log("AgentPhone voice message", event);
    return {
      messages: [
        {
          type: "text",
          text: "Thanks, I can help with that.",
        },
      ],
    };
  },
});

export const onCallEnded = action({
  args: webhookEvent.fields,
  returns: v.null(),
  handler: async (_ctx, event) => {
    console.log("AgentPhone call ended", event);
    return null;
  },
});

export const onReaction = action({
  args: webhookEvent.fields,
  returns: v.null(),
  handler: async (_ctx, event) => {
    console.log("AgentPhone reaction", event);
    return null;
  },
});
