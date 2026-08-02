export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export type AgentPhoneChannel =
  | "sms"
  | "mms"
  | "imessage"
  | "voice"
  | "whatsapp"
  | (string & {});

export interface RecentHistoryItem {
  content: string;
  direction: string;
  channel: AgentPhoneChannel;
  at: string;
  senderIdentifier?: string;
}

export interface GroupParticipant {
  identifier: string;
  name: string | null;
}

export interface GroupDetails {
  isGroup: true;
  groupId: string;
  groupName: string | null;
  groupIconUrl: string | null;
  participants: GroupParticipant[];
}

export interface MessageEventData {
  conversationId?: string;
  numberId?: string;
  callId?: string;
  from: string;
  to: string;
  direction: string;
  message?: string;
  mediaUrl?: string | null;
  receivedAt?: string;
  transcript?: string;
  confidence?: number;
  status?: string;
  senderIdentifier?: string;
  group?: GroupDetails;
}

export interface ReactionEventData {
  conversationId: string;
  numberId: string;
  reactionType: string;
  fromNumber: string;
  direction: string;
  messageId: string;
  messageBody: string;
  messageMediaUrl: string | null;
  createdAt: string;
}

export interface CallTranscriptItem {
  role: "agent" | "user" | string;
  content: string;
}

export interface CallEndedEventData {
  callId: string;
  numberId: string;
  from: string;
  to: string;
  direction: string;
  status: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  disconnectionReason?: string;
  transcript: CallTranscriptItem[];
  summary?: string | null;
  userSentiment?: string | null;
  callSuccessful?: boolean | null;
}

export interface AgentPhoneEvent<TData = unknown> {
  event: string;
  channel: AgentPhoneChannel;
  timestamp: string;
  agentId?: string | null;
  data: TData;
  conversationState?: unknown;
  recentHistory?: RecentHistoryItem[];
}

export interface AgentMessageEvent extends AgentPhoneEvent<MessageEventData> {
  event: "agent.message";
}

export interface AgentReactionEvent extends AgentPhoneEvent<ReactionEventData> {
  event: "agent.reaction";
  channel: "imessage";
}

export interface AgentCallEndedEvent extends AgentPhoneEvent<CallEndedEventData> {
  event: "agent.call_ended";
  channel: "voice";
}

export function isMessageEvent(
  event: AgentPhoneEvent,
): event is AgentMessageEvent {
  return event.event === "agent.message";
}

export function isReactionEvent(
  event: AgentPhoneEvent,
): event is AgentReactionEvent {
  return event.event === "agent.reaction";
}

export function isCallEndedEvent(
  event: AgentPhoneEvent,
): event is AgentCallEndedEvent {
  return event.event === "agent.call_ended";
}

export interface VoiceWebhookResponse {
  text?: string;
  hangup?: boolean;
  action?: "transfer" | "hangup";
  digits?: string;
  send_message?: { body: string; to?: string };
  interim?: boolean;
}

export interface StoredEvent {
  scope: string;
  source: "webhook" | "api";
  deliveryId?: string;
  eventType: string;
  channel?: string;
  timestamp: string;
  receivedAt: number;
  agentId?: string;
  numberId?: string;
  conversationId?: string;
  callId?: string;
  messageId?: string;
  direction?: string;
  payload: unknown;
}

export type SendStyle =
  | "celebration"
  | "fireworks"
  | "lasers"
  | "love"
  | "confetti"
  | "balloons"
  | "spotlight"
  | "echo"
  | "invisible"
  | "gentle"
  | "loud"
  | "slam";

export interface SendMessageArgs {
  agentId?: string;
  toNumber?: string;
  recipients?: string[];
  body: string;
  mediaUrls?: string[];
  numberId?: string;
  fromNumber?: string;
  channel?: "whatsapp";
  sendStyle?: SendStyle;
  replyToMessageId?: string;
  buttons?: string[];
  list?: JsonValue;
}

export interface SendMessageResult {
  id: string;
  status: string;
  channel: string;
  from_number: string;
  to_number: string;
  conversation_id: string | null;
  media_urls?: string[];
  reply_to_message_id?: string | null;
  reply_parent_unresolved?: boolean | null;
}

export interface CreateOutboundCallArgs {
  agentId?: string;
  toNumber: string;
  fromNumberId?: string;
  initialGreeting?: string;
  voice?: string;
  systemPrompt?: string;
  modelTier?: "turbo" | "balanced" | "max";
  variables?: Record<string, string>;
  callScreeningIdentity?: string;
  callScreeningPurpose?: string;
}

export interface CreateWebCallArgs {
  agentId?: string;
  metadata?: JsonValue;
  variables?: Record<string, string>;
}

export interface CallSummary {
  id: string;
  agentId: string | null;
  phoneNumberId: string | null;
  phoneNumber: string | null;
  fromNumber: string;
  toNumber: string;
  direction?: "inbound" | "outbound" | "web" | string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  lastTranscriptSnippet?: string | null;
  recordingUrl?: string | null;
  recordingAvailable?: boolean;
}

export interface WebCallResult {
  callId: string;
  accessToken: string;
  [key: string]: JsonValue;
}

export interface Agent {
  id: string;
  name: string;
  description: string | null;
  voiceMode: "webhook" | "hosted" | string;
  voice: string;
  createdAt: string;
  systemPrompt?: string | null;
  beginMessage?: string | null;
  numbers?: PhoneNumber[] | null;
}

export interface AgentListResponse {
  data?: Agent[];
  agents?: Agent[];
  total?: number;
}

export interface CreateAgentArgs {
  name: string;
  description?: string | null;
  voiceMode?: "webhook" | "hosted";
  enableMessaging?: boolean | null;
  modelTier?: "turbo" | "balanced" | "max";
  systemPrompt?: string | null;
  beginMessage?: string | null;
  voice?: string | null;
  transferNumber?: string | null;
  customTools?: JsonValue[] | null;
  voicemailMessage?: string | null;
  callScreeningIdentity?: string | null;
  callScreeningPurpose?: string | null;
  sttMode?: "fast" | "accurate";
  ambientSound?: "none" | "office" | "coffee-shop" | "outdoor";
  denoisingMode?:
    | "noise-cancellation"
    | "noise-and-background-speech-cancellation";
  maxSilenceMs?: number | null;
  voiceSpeed?: number | null;
  interruptionSensitivity?: number | null;
  enableBackchannel?: boolean | null;
  language?: string;
}

export type UpdateAgentArgs = Partial<CreateAgentArgs>;

export interface PhoneNumber {
  id: string;
  phoneNumber: string;
  country: string;
  status: string;
  type?: string;
  agentId?: string | null;
  createdAt: string;
}

export interface PhoneNumberListResponse {
  data?: PhoneNumber[];
  numbers?: PhoneNumber[];
  total?: number;
}

export interface ProvisionNumberArgs {
  country?: string;
  areaCode?: string;
  agentId?: string;
}

export interface Conversation {
  id: string;
  agentId?: string | null;
  phoneNumberId: string;
  phoneNumber: string;
  participant: string;
  isGroup?: boolean;
  groupId?: string | null;
  groupName?: string | null;
  lastMessageAt: string;
  messageCount: number;
  metadata?: JsonValue | null;
  createdAt: string;
  messages?: JsonValue[];
}

export interface ConversationListResponse {
  data?: Conversation[];
  conversations?: Conversation[];
  total?: number;
}

export interface UsageResponse {
  plan: JsonValue;
  numbers: JsonValue;
  stats: JsonValue;
  periodStart: string;
  periodEnd: string;
}

export interface WebhookConfiguration {
  id: string;
  url: string;
  secret: string;
  status: string;
  contextLimit: number;
  timeout: number;
  createdAt: string;
}

export interface ConfigureWebhookArgs {
  url?: string;
  contextLimit?: number;
  timeout?: number;
  subAccountId?: string;
}

export interface QueueOptions {
  /** Deduplicate retries or repeated user submissions within this component scope. */
  idempotencyKey?: string;
  /** Total delivery attempts, including the first. Must be between 1 and 5. */
  maxAttempts?: number;
  /** Skip the provider call while exercising the durable queue and local state. */
  testMode?: boolean;
}

export interface SyncPageArgs {
  limit?: number;
  offset?: number;
}

export interface SyncResult<T = unknown> {
  synced: number;
  response: T;
}

export interface TestModeResult {
  testMode: true;
  status: "skipped";
  kind: "message" | "outbound_call" | "web_call";
  args: JsonValue;
}

export type DeliveryStatus =
  | "received"
  | "dispatching"
  | "dispatched"
  | "retrying"
  | "failed"
  | "dead_letter"
  | "ignored";

export type OutboundStatus =
  | "queued"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

export interface RequestArgs<TBody = JsonValue> {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, JsonPrimitive>;
  body?: TBody;
  subAccountId?: string;
}
