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
 * A sub-account registry entry is `provisioning` while a create holds the
 * claim, `active` once AgentPhone has returned an id, and `unresolved` when a
 * create ended without learning whether AgentPhone made the sub-account. The
 * claim is what keeps one tenant key from provisioning two sub-accounts, and
 * the status is what says whether anyone is still working on it.
 */
export const subAccountStatusValidator = v.union(
  v.literal("provisioning"),
  v.literal("unresolved"),
  v.literal("active"),
);

export const subAccountFields = {
  scope: v.string(),
  /** Caller-supplied tenant key. Unique within a scope when present. */
  key: v.optional(v.string()),
  /** AgentPhone sub-account id. Present exactly when `status` is `active`. */
  subAccountId: v.optional(v.string()),
  name: v.optional(v.string()),
  status: subAccountStatusValidator,
  /** Why an `unresolved` claim could not be settled. */
  error: v.optional(v.string()),
  payload: v.any(),
  syncedAt: v.number(),
  updatedAt: v.number(),
};

/** A registry entry AgentPhone has already assigned an id to. */
export const provisionedSubAccountValidator = v.object({
  ...subAccountFields,
  subAccountId: v.string(),
  status: v.literal("active"),
});

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
