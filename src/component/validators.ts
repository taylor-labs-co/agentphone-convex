import { v } from "convex/values";

export const nullableString = v.union(v.string(), v.null());

export const sourceValidator = v.union(v.literal("webhook"), v.literal("api"));

export const deliveryStatusValidator = v.union(
  v.literal("received"),
  v.literal("dispatching"),
  v.literal("dispatched"),
  v.literal("retrying"),
  v.literal("failed"),
  v.literal("dead_letter"),
  v.literal("ignored"),
);

export const outboundKindValidator = v.union(
  v.literal("message"),
  v.literal("outbound_call"),
  v.literal("web_call"),
);

export const outboundStatusValidator = v.union(
  v.literal("queued"),
  v.literal("sending"),
  v.literal("sent"),
  v.literal("failed"),
  v.literal("cancelled"),
);

/**
 * AgentPhone may add event and channel values without a component release, so
 * those fields intentionally remain strings while the exported TypeScript
 * types describe today's known values.
 */
export const agentPhoneEventValidator = v.object({
  event: v.string(),
  channel: v.string(),
  timestamp: v.string(),
  agentId: v.optional(nullableString),
  data: v.any(),
  conversationState: v.optional(v.any()),
  recentHistory: v.optional(v.array(v.any())),
});

export const voiceWebhookResponseValidator = v.object({
  text: v.optional(v.string()),
  hangup: v.optional(v.boolean()),
  action: v.optional(v.union(v.literal("transfer"), v.literal("hangup"))),
  digits: v.optional(v.string()),
  send_message: v.optional(
    v.object({
      body: v.string(),
      to: v.optional(v.string()),
    }),
  ),
  interim: v.optional(v.boolean()),
});

export const queryValueValidator = v.union(
  v.string(),
  v.number(),
  v.boolean(),
  v.null(),
);

export const requestMethodValidator = v.union(
  v.literal("GET"),
  v.literal("POST"),
  v.literal("PATCH"),
  v.literal("PUT"),
  v.literal("DELETE"),
);

export const webhookResponseValidator = v.object({
  id: v.string(),
  url: v.string(),
  secret: v.string(),
  status: v.string(),
  contextLimit: v.number(),
  timeout: v.number(),
  createdAt: v.string(),
});
