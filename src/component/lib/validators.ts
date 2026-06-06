import { v } from "convex/values";

export const json = v.any();

export const paginationArgs = {
  limit: v.optional(v.number()),
  offset: v.optional(v.number()),
};

export const dateRangeArgs = {
  start_date: v.optional(v.string()),
  end_date: v.optional(v.string()),
};

export const agentIdArg = {
  agent_id: v.string(),
};

export const numberIdArg = {
  number_id: v.string(),
};

export const conversationIdArg = {
  conversation_id: v.string(),
};

export const callIdArg = {
  call_id: v.string(),
};

export const callbackName = v.union(
  v.literal("onMessage"),
  v.literal("onVoiceMessage"),
  v.literal("onCallEnded"),
  v.literal("onReaction"),
);

export const webhookCallbackHandles = v.object({
  onMessage: v.optional(v.string()),
  onVoiceMessage: v.optional(v.string()),
  onCallEnded: v.optional(v.string()),
  onReaction: v.optional(v.string()),
});

export const normalizedWebhookEvent = v.object({
  event: v.string(),
  channel: v.optional(v.string()),
  callback: v.optional(callbackName),
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
  payload: json,
});

export const apiOptions = v.object({
  requestTimeoutMs: v.optional(v.number()),
});

export function stripUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}
