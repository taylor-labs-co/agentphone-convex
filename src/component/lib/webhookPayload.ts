import type { Infer } from "convex/values";

import { normalizedWebhookEvent } from "./validators.js";

export type CallbackName =
  | "onMessage"
  | "onVoiceMessage"
  | "onCallEnded"
  | "onReaction";

export type NormalizedWebhookEvent = Infer<typeof normalizedWebhookEvent>;

type UnknownRecord = Record<string, unknown>;

export function callbackForEvent(
  event: string,
  channel?: string | null,
): CallbackName | undefined {
  if (event === "agent.message" && channel === "voice") {
    return "onVoiceMessage";
  }
  if (event === "agent.message") {
    return "onMessage";
  }
  if (event === "agent.call_ended" || event === "call.ended") {
    return "onCallEnded";
  }
  if (
    event === "agent.reaction" ||
    event === "message.reaction" ||
    event === "reaction.created"
  ) {
    return "onReaction";
  }
  return undefined;
}

export function normalizeWebhookPayload(payload: unknown): NormalizedWebhookEvent {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const event = asString(root.event) ?? asString(root.type) ?? "unknown";
  const channel =
    asString(root.channel) ?? asString(data.channel) ?? asString(root.medium);
  const callback = callbackForEvent(event, channel);
  const text =
    asString(data.message) ??
    asString(data.text) ??
    asString(data.body) ??
    asString(data.transcript) ??
    asString(root.message) ??
    asString(root.text);

  return {
    event,
    ...(channel === undefined ? {} : { channel }),
    ...(callback === undefined ? {} : { callback }),
    ...(asString(root.agentId) ??
    asString(root.agent_id) ??
    asString(data.agentId) ??
    asString(data.agent_id)
      ? {
          agentId: String(
            asString(root.agentId) ??
              asString(root.agent_id) ??
              asString(data.agentId) ??
              asString(data.agent_id),
          ),
        }
      : {}),
    ...(asString(data.conversationId) ?? asString(data.conversation_id)
      ? {
          conversationId: String(
            asString(data.conversationId) ?? asString(data.conversation_id),
          ),
        }
      : {}),
    ...(asString(data.callId) ?? asString(data.call_id)
      ? { callId: String(asString(data.callId) ?? asString(data.call_id)) }
      : {}),
    ...(asString(data.numberId) ?? asString(data.number_id)
      ? { numberId: String(asString(data.numberId) ?? asString(data.number_id)) }
      : {}),
    ...(asString(data.messageId) ?? asString(data.message_id)
      ? {
          messageId: String(
            asString(data.messageId) ?? asString(data.message_id),
          ),
        }
      : {}),
    ...(text === undefined ? {} : { text }),
    ...(asString(data.from) ? { from: String(data.from) } : {}),
    ...(asString(data.to) ? { to: String(data.to) } : {}),
    ...(asString(data.direction) ? { direction: String(data.direction) } : {}),
    ...(asString(root.timestamp) ?? asString(data.timestamp)
      ? { timestamp: String(asString(root.timestamp) ?? asString(data.timestamp)) }
      : {}),
    payload,
  };
}

export function redactedWebhookConfig<T extends UnknownRecord>(config: T) {
  const { secret, signingSecret, webhookSecret, ...rest } = config;
  return {
    ...rest,
    hasSecret: Boolean(secret ?? signingSecret ?? webhookSecret),
  };
}

export function parseWebhookBody(rawBody: string) {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch (error) {
    throw new Error(
      `AgentPhone webhook body must be valid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

export function extractWebhookSecret(providerResponse: unknown) {
  const response = asRecord(providerResponse);
  return (
    asString(response.secret) ??
    asString(response.signingSecret) ??
    asString(response.webhookSecret)
  );
}

function asRecord(value: unknown): UnknownRecord {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as UnknownRecord;
  }
  return {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
