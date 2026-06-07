import type { NormalizedWebhookEvent } from "./webhookPayload.js";

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
  webhookId: string;
  receivedAt: number;
  normalized: NormalizedWebhookEvent;
  payload: unknown;
}): ResourceSnapshots {
  const { normalized, payload, receivedAt, webhookId } = args;
  const source = asRecord(payload);
  const data = asRecord(source.data);
  const timestamp = parseTimestamp(normalized.timestamp) ?? receivedAt;
  const counterparty = counterpartyFor({
    direction: normalized.direction,
    from: normalized.from,
    to: normalized.to,
  });

  const agent = normalized.agentId
    ? {
        agentId: normalized.agentId,
        payload: pickPayload(data.agent ?? source.agent ?? payload),
      }
    : undefined;

  const number = normalized.numberId
    ? {
        numberId: normalized.numberId,
        agentId: normalized.agentId,
        phoneNumber:
          asString(data.phone_number) ??
          asString(data.phoneNumber) ??
          asString(data.number),
        payload: pickPayload(data.number ?? source.number ?? payload),
      }
    : undefined;

  const conversation = normalized.conversationId
    ? {
        conversationId: normalized.conversationId,
        agentId: normalized.agentId,
        numberId: normalized.numberId,
        counterparty,
        lastMessageId: normalized.messageId,
        lastMessageText: normalized.text,
        lastDirection: normalized.direction,
        lastActivityAt: timestamp,
        payload: pickPayload(data.conversation ?? source.conversation ?? payload),
      }
    : undefined;

  const message =
    normalized.messageId || normalized.event === "agent.message"
      ? {
          messageId: normalized.messageId ?? `webhook:${webhookId}`,
          conversationId: normalized.conversationId,
          agentId: normalized.agentId,
          numberId: normalized.numberId,
          callId: normalized.callId,
          channel: normalized.channel,
          direction: normalized.direction,
          from: normalized.from,
          to: normalized.to,
          counterparty,
          body: normalized.text,
          text: normalized.text,
          timestamp,
          payload: pickPayload(data.messageObject ?? data.message ?? data ?? payload),
        }
      : undefined;

  const call = normalized.callId
    ? {
        callId: normalized.callId,
        agentId: normalized.agentId,
        numberId: normalized.numberId,
        conversationId: normalized.conversationId,
        from: normalized.from,
        to: normalized.to,
        status: asString(data.status),
        direction: normalized.direction,
        endedAt:
          normalized.event === "agent.call_ended" ? timestamp : undefined,
        startedAt: parseTimestamp(asString(data.started_at) ?? asString(data.startedAt)),
        durationSeconds:
          asNumber(data.duration_seconds) ?? asNumber(data.durationSeconds),
        payload: pickPayload(data.call ?? source.call ?? data ?? payload),
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
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
