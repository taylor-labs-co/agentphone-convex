import type { Infer } from "convex/values";
import { agentPhoneEventValidator } from "../validators.js";

type AgentPhoneEvent = Infer<typeof agentPhoneEventValidator>;

type UnknownRecord = Record<string, unknown>;

export type ResourceSnapshots = {
  agent?: UnknownRecord | undefined;
  number?: UnknownRecord | undefined;
  conversation?: UnknownRecord | undefined;
  message?: UnknownRecord | undefined;
  call?: UnknownRecord | undefined;
};

export function extractAgentPhoneRecords(response: unknown): UnknownRecord[] {
  if (Array.isArray(response)) {
    return response.filter(isRecord);
  }
  const record = asRecord(response);
  for (const key of [
    "data",
    "items",
    "results",
    "agents",
    "numbers",
    "conversations",
    "messages",
    "calls",
    "subAccounts",
    "sub_accounts",
  ]) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }
  return isRecord(response) ? [response] : [];
}

export function providerId(record: unknown, keys: string[]) {
  const source = asRecord(record);
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

export function resourceSnapshotsFromWebhook(args: {
  deliveryId: string;
  receivedAt: number;
  event: AgentPhoneEvent;
}): ResourceSnapshots {
  const { event, receivedAt, deliveryId } = args;
  const data = asRecord(event.data);
  const timestamp = parseTimestamp(event.timestamp) ?? receivedAt;
  const agentId = asString(event.agentId ?? undefined);
  const conversationId = asString(data.conversationId ?? data.conversation_id);
  const callId = asString(data.callId ?? data.call_id);
  const numberId = asString(data.numberId ?? data.number_id);
  const messageId = asString(data.messageId ?? data.message_id);
  const direction = asString(data.direction);
  const from = asString(data.from) ?? asString(data.fromNumber);
  const to = asString(data.to) ?? asString(data.toNumber);
  const text =
    asString(data.message) ??
    asString(data.text) ??
    asString(data.body) ??
    asString(data.transcript);
  const counterparty = counterpartyFor({
    direction,
    from,
    to,
  });

  const agent = agentId
    ? {
        agentId,
        payload: pickPayload(data.agent ?? event),
      }
    : undefined;

  const number = numberId
    ? {
        numberId,
        agentId,
        phoneNumber:
          asString(data.phone_number) ??
          asString(data.phoneNumber) ??
          asString(data.number),
        payload: pickPayload(data.number ?? event),
      }
    : undefined;

  const conversation = conversationId
    ? {
        conversationId,
        agentId,
        numberId,
        counterparty,
        lastMessageId: messageId,
        lastMessageText: text,
        lastDirection: direction,
        lastActivityAt: timestamp,
        payload: pickPayload(data.conversation ?? event),
      }
    : undefined;

  const message =
    messageId || event.event === "agent.message"
      ? {
          messageId: messageId ?? `webhook:${deliveryId}`,
          conversationId,
          agentId,
          numberId,
          callId,
          channel: event.channel,
          direction,
          from,
          to,
          counterparty,
          body: text,
          timestamp,
          payload: pickPayload(
            data.messageObject ?? data.message ?? data ?? event,
          ),
        }
      : undefined;

  const call = callId
    ? {
        callId,
        agentId,
        numberId,
        conversationId,
        from,
        to,
        status: asString(data.status),
        direction,
        endedAt: event.event === "agent.call_ended" ? timestamp : undefined,
        startedAt: parseTimestamp(
          asString(data.started_at) ?? asString(data.startedAt),
        ),
        durationSeconds:
          asNumber(data.duration_seconds) ?? asNumber(data.durationSeconds),
        payload: pickPayload(data.call ?? data ?? event),
      }
    : undefined;

  return stripUndefined({ agent, number, conversation, message, call });
}

export function counterpartyFor(args: {
  direction?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}) {
  if (args.direction === "outbound") {
    return args.to;
  }
  return args.from ?? args.to;
}

export function parseTimestamp(value: string | undefined) {
  if (!value) {
    return undefined;
  }
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickPayload(value: unknown) {
  return value === undefined ? {} : value;
}

function stripUndefined<T extends UnknownRecord>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function asRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}
