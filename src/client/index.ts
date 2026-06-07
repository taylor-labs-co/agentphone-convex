import {
  createFunctionHandle,
  type GenericActionCtx,
  type GenericDataModel,
  type GenericMutationCtx,
  type GenericQueryCtx,
  httpActionGeneric,
  type FunctionReference,
  type HttpRouter,
} from "convex/server";
import type { Infer } from "convex/values";

import schema from "../component/schema.js";

type RunActionCtx = {
  runAction: GenericActionCtx<GenericDataModel>["runAction"];
};

type RunQueryCtx = {
  runQuery: GenericQueryCtx<GenericDataModel>["runQuery"];
};

type RunMutationCtx = {
  runMutation: GenericMutationCtx<GenericDataModel>["runMutation"];
};

export type AgentPhoneComponent = Record<string, any>;

export const agentValidator = schema.tables.agents.validator;
export const numberValidator = schema.tables.numbers.validator;
export const conversationValidator = schema.tables.conversations.validator;
export const messageValidator = schema.tables.messages.validator;
export const callValidator = schema.tables.calls.validator;
export const normalizedWebhookEventValidator =
  schema.tables.webhookEvents.validator.fields.normalized;

export type AgentPhoneAgent = Infer<typeof agentValidator>;
export type AgentPhoneNumber = Infer<typeof numberValidator>;
export type AgentPhoneConversation = Infer<typeof conversationValidator>;
export type AgentPhoneMessage = Infer<typeof messageValidator>;
export type AgentPhoneCall = Infer<typeof callValidator>;

export type AgentPhoneAgentId = string & { __brand: "AgentPhoneAgentId" };
export type AgentPhoneNumberId = string & { __brand: "AgentPhoneNumberId" };
export type AgentPhoneConversationId = string & {
  __brand: "AgentPhoneConversationId";
};
export type AgentPhoneMessageId = string & { __brand: "AgentPhoneMessageId" };
export type AgentPhoneCallId = string & { __brand: "AgentPhoneCallId" };

export type AgentPhoneCallbackReferences = {
  onMessage?: FunctionReference<"action", "public" | "internal", any, any>;
  onVoiceMessage?: FunctionReference<"action", "public" | "internal", any, any>;
  onCallEnded?: FunctionReference<"action", "public" | "internal", any, any>;
  onReaction?: FunctionReference<"action", "public" | "internal", any, any>;
};

export type AgentPhoneOptions = {
  httpPrefix?: string;
  testMode?: boolean;
};

export class AgentPhone {
  private readonly httpPrefix: string;
  private readonly testMode: boolean;

  constructor(
    private readonly component: AgentPhoneComponent,
    options: AgentPhoneOptions = {},
  ) {
    this.httpPrefix = options.httpPrefix ?? "/agentphone";
    this.testMode = options.testMode ?? false;
  }

  registerRoutes(
    http: HttpRouter,
    options: {
      path?: string;
      onVoiceMessage?: (event: unknown) => Response | Promise<Response>;
      onVerifiedEvent?: (event: unknown) => void | Promise<void>;
    } = {},
  ) {
    const handlerOptions: {
      onVoiceMessage?: (event: unknown) => Response | Promise<Response>;
      onVerifiedEvent?: (event: unknown) => void | Promise<void>;
    } = {};
    if (options.onVoiceMessage) {
      handlerOptions.onVoiceMessage = options.onVoiceMessage;
    }
    if (options.onVerifiedEvent) {
      handlerOptions.onVerifiedEvent = options.onVerifiedEvent;
    }
    http.route({
      path: options.path ?? `${this.httpPrefix}/webhook`,
      method: "POST",
      handler: httpActionGeneric((ctx, request) =>
        handleAgentPhoneWebhook(
          ctx as RunActionCtx,
          this.component,
          request,
          handlerOptions,
        ),
      ),
    });
  }

  listAgents(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.agents.list, args);
  }

  createAgent(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.agents.create, args);
  }

  getAgent(ctx: RunActionCtx, args: { agent_id: string }) {
    return ctx.runAction(this.component.agents.get, args);
  }

  updateAgent(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.agents.update, args);
  }

  deleteAgent(ctx: RunActionCtx, args: { agent_id: string }) {
    return ctx.runAction(this.component.agents.remove, args);
  }

  attachNumberToAgent(
    ctx: RunActionCtx,
    args: { agent_id: string; number_id: string },
  ) {
    return ctx.runAction(this.component.agents.attachNumber, args);
  }

  detachNumberFromAgent(
    ctx: RunActionCtx,
    args: { agent_id: string; number_id: string },
  ) {
    return ctx.runAction(this.component.agents.detachNumber, args);
  }

  listVoices(ctx: RunActionCtx) {
    return ctx.runAction(this.component.agents.listVoices, {});
  }

  listAgentConversations(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.agents.listConversations, args);
  }

  listAgentCalls(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.agents.listCalls, args);
  }

  listNumbers(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.numbers.list, args);
  }

  provisionNumber(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.numbers.create, args);
  }

  releaseNumber(ctx: RunActionCtx, args: { number_id: string }) {
    return ctx.runAction(this.component.numbers.release, args);
  }

  listNumberMessages(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.numbers.listMessages, args);
  }

  sendMessage(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.messages.send, this.withTestMode(args));
  }

  sendReaction(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.messages.sendReaction, args);
  }

  listConversations(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.conversations.list, args);
  }

  getConversation(ctx: RunActionCtx, args: { conversation_id: string }) {
    return ctx.runAction(this.component.conversations.get, args);
  }

  updateConversation(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.conversations.update, args);
  }

  listConversationMessages(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.conversations.listMessages, args);
  }

  sendTypingIndicator(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.conversations.sendTypingIndicator, args);
  }

  listCalls(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.calls.list, args);
  }

  listCallsForNumber(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.calls.listForNumber, args);
  }

  getCall(ctx: RunActionCtx, args: { call_id: string }) {
    return ctx.runAction(this.component.calls.get, args);
  }

  createOutboundCall(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(
      this.component.calls.createOutbound,
      this.withTestMode(args),
    );
  }

  createWebCall(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.calls.createWeb, this.withTestMode(args));
  }

  endCall(ctx: RunActionCtx, args: { call_id: string }) {
    return ctx.runAction(this.component.calls.end, args);
  }

  getCallRecording(ctx: RunActionCtx, args: { call_id: string }) {
    return ctx.runAction(this.component.calls.getRecording, args);
  }

  getCallTranscript(ctx: RunActionCtx, args: { call_id: string }) {
    return ctx.runAction(this.component.calls.getTranscript, args);
  }

  configureProjectWebhook(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.webhooks.configureProjectWebhook, args);
  }

  ensureProjectWebhook(
    ctx: RunActionCtx,
    args: {
      url?: string;
      eventTypes?: string[];
      contextLimit?: number;
      timeoutMs?: number;
    } = {},
  ) {
    return ctx.runAction(
      this.component.webhooks.ensureProjectWebhook,
      this.stripUndefined({
        url: args.url,
        event_types: args.eventTypes,
        context_limit: args.contextLimit,
        timeout_ms: args.timeoutMs,
        http_prefix: this.httpPrefix,
      }),
    );
  }

  getProjectWebhook(ctx: RunActionCtx) {
    return ctx.runAction(this.component.webhooks.getProjectWebhook, {});
  }

  deleteProjectWebhook(ctx: RunActionCtx) {
    return ctx.runAction(this.component.webhooks.deleteProjectWebhook, {});
  }

  testProjectWebhook(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.webhooks.testProjectWebhook, args);
  }

  configureAgentWebhook(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.webhooks.configureAgentWebhook, args);
  }

  getAgentWebhook(ctx: RunActionCtx, args: { agent_id: string }) {
    return ctx.runAction(this.component.webhooks.getAgentWebhook, args);
  }

  deleteAgentWebhook(ctx: RunActionCtx, args: { agent_id: string }) {
    return ctx.runAction(this.component.webhooks.deleteAgentWebhook, args);
  }

  listAgentWebhookDeliveries(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.webhooks.listAgentDeliveries, args);
  }

  testAgentWebhook(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.webhooks.testAgentWebhook, args);
  }

  listProviderWebhookDeliveries(
    ctx: RunActionCtx,
    args: Record<string, unknown> = {},
  ) {
    return ctx.runAction(this.component.webhooks.listProviderDeliveries, args);
  }

  getWebhookDeliveryStats(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.webhooks.deliveryStats, args);
  }

  getWebhookAllTimeStats(ctx: RunActionCtx) {
    return ctx.runAction(this.component.webhooks.allTimeStats, {});
  }

  listStoredWebhookConfigs(ctx: RunQueryCtx) {
    return ctx.runQuery(this.component.webhooks.listStoredConfigs, {});
  }

  listWebhookDeliveries(ctx: RunQueryCtx, args: Record<string, unknown> = {}) {
    return ctx.runQuery(this.component.webhooks.listDeliveries, args);
  }

  listFailedWebhookDeliveries(
    ctx: RunQueryCtx,
    args: Record<string, unknown> = {},
  ) {
    return ctx.runQuery(this.component.webhooks.listFailedDeliveries, args);
  }

  replayWebhookDelivery(ctx: RunActionCtx, args: { webhookId: string }) {
    return ctx.runAction(this.component.webhooks.replayDelivery, args);
  }

  cleanupWebhookDeliveries(
    ctx: RunActionCtx,
    args: { olderThanMs?: number; statuses?: string[] } = {},
  ) {
    return ctx.runAction(this.component.webhooks.cleanupDeliveries, args);
  }

  async registerCallbacks(
    ctx: RunMutationCtx,
    callbacks: AgentPhoneCallbackReferences,
    options: { agentId?: string } = {},
  ) {
    const handles = Object.fromEntries(
      await Promise.all(
        Object.entries(callbacks).map(async ([name, reference]) => [
          name,
          reference ? await createFunctionHandle(reference) : undefined,
        ]),
      ),
    );
    return ctx.runMutation(
      this.component.webhooks.registerCallbacks,
      this.stripUndefined({
        agent_id: options.agentId,
        callbacks: handles,
      }),
    );
  }

  listLocalAgents(ctx: RunQueryCtx, args: Record<string, unknown> = {}) {
    return ctx.runQuery(this.component.resources.listAgents, args);
  }

  getLocalAgent(ctx: RunQueryCtx, args: { agentId: string }) {
    return ctx.runQuery(this.component.resources.getAgent, args);
  }

  listLocalNumbers(ctx: RunQueryCtx, args: Record<string, unknown> = {}) {
    return ctx.runQuery(this.component.resources.listNumbers, args);
  }

  getLocalNumber(ctx: RunQueryCtx, args: { numberId: string }) {
    return ctx.runQuery(this.component.resources.getNumber, args);
  }

  listLocalConversations(ctx: RunQueryCtx, args: Record<string, unknown> = {}) {
    return ctx.runQuery(this.component.resources.listConversations, args);
  }

  getLocalConversation(ctx: RunQueryCtx, args: { conversationId: string }) {
    return ctx.runQuery(this.component.resources.getConversation, args);
  }

  listMessagesByConversation(
    ctx: RunQueryCtx,
    args: { conversationId: string; limit?: number },
  ) {
    return ctx.runQuery(this.component.resources.listMessagesByConversation, args);
  }

  listMessagesByAgent(
    ctx: RunQueryCtx,
    args: { agentId: string; limit?: number },
  ) {
    return ctx.runQuery(this.component.resources.listMessagesByAgent, args);
  }

  listMessagesByNumber(
    ctx: RunQueryCtx,
    args: { numberId: string; limit?: number },
  ) {
    return ctx.runQuery(this.component.resources.listMessagesByNumber, args);
  }

  listMessagesByCounterparty(
    ctx: RunQueryCtx,
    args: { counterparty: string; limit?: number },
  ) {
    return ctx.runQuery(
      this.component.resources.listMessagesByCounterparty,
      args,
    );
  }

  listCallsByAgent(ctx: RunQueryCtx, args: { agentId: string; limit?: number }) {
    return ctx.runQuery(this.component.resources.listCallsByAgent, args);
  }

  listCallsByNumber(
    ctx: RunQueryCtx,
    args: { numberId: string; limit?: number },
  ) {
    return ctx.runQuery(this.component.resources.listCallsByNumber, args);
  }

  getLatestConversationState(
    ctx: RunQueryCtx,
    args: { conversationId: string; messageLimit?: number },
  ) {
    return ctx.runQuery(this.component.resources.getLatestConversationState, args);
  }

  getLocalCallTranscript(ctx: RunQueryCtx, args: { callId: string }) {
    return ctx.runQuery(this.component.resources.getCallTranscript, args);
  }

  getLocalCallRecording(ctx: RunQueryCtx, args: { callId: string }) {
    return ctx.runQuery(this.component.resources.getCallRecording, args);
  }

  enqueueMessage(ctx: RunMutationCtx, args: Record<string, unknown>) {
    return ctx.runMutation(
      this.component.outbound.enqueueMessage,
      this.withTestMode(args),
    );
  }

  enqueueOutboundCall(ctx: RunMutationCtx, args: Record<string, unknown>) {
    return ctx.runMutation(
      this.component.outbound.enqueueOutboundCall,
      this.withTestMode(args),
    );
  }

  enqueueWebCall(ctx: RunMutationCtx, args: Record<string, unknown>) {
    return ctx.runMutation(
      this.component.outbound.enqueueWebCall,
      this.withTestMode(args),
    );
  }

  getOutboundStatus(ctx: RunQueryCtx, args: { requestId: string }) {
    return ctx.runQuery(this.component.outbound.getStatus, args);
  }

  listOutboundRequests(ctx: RunQueryCtx, args: Record<string, unknown> = {}) {
    return ctx.runQuery(this.component.outbound.listRequests, args);
  }

  cancelOutboundRequest(ctx: RunMutationCtx, args: { requestId: string }) {
    return ctx.runMutation(this.component.outbound.cancel, args);
  }

  getUsage(ctx: RunActionCtx) {
    return ctx.runAction(this.component.usage.get, {});
  }

  getDailyUsage(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.usage.daily, args);
  }

  getMonthlyUsage(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.usage.monthly, args);
  }

  getUsageByNumber(ctx: RunActionCtx) {
    return ctx.runAction(this.component.usage.byNumber, {});
  }

  getUsageByAgent(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.usage.byAgent, args);
  }

  syncAgents(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.sync.syncAgents, args);
  }

  syncNumbers(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.sync.syncNumbers, args);
  }

  syncRecentConversations(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.sync.syncRecentConversations, args);
  }

  syncRecentMessages(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.sync.syncRecentMessages, args);
  }

  syncRecentCalls(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.sync.syncRecentCalls, args);
  }

  reconcileWebhookConfig(ctx: RunActionCtx, args: Record<string, unknown> = {}) {
    return ctx.runAction(this.component.sync.reconcileWebhookConfig, args);
  }

  private withTestMode(args: Record<string, unknown>) {
    if (!this.testMode || args.test_mode !== undefined) {
      return args;
    }
    return { ...args, test_mode: true };
  }

  private stripUndefined<T extends Record<string, unknown>>(value: T): T {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined),
    ) as T;
  }
}

export async function handleAgentPhoneWebhook(
  ctx: RunActionCtx,
  component: AgentPhoneComponent,
  request: Request,
  options: {
    onVoiceMessage?: (event: unknown) => Response | Promise<Response>;
    onVerifiedEvent?: (event: unknown) => void | Promise<void>;
  } = {},
) {
  const rawBody = await request.text();
  const verified = (await ctx.runAction(component.webhooks.verifyAndRecord, {
    rawBody,
    signature: request.headers.get("X-Webhook-Signature") ?? undefined,
    timestamp: request.headers.get("X-Webhook-Timestamp") ?? undefined,
    webhookId:
      request.headers.get("X-Webhook-ID") ??
      request.headers.get("X-AgentPhone-Webhook-ID") ??
      crypto.randomUUID(),
  })) as {
    accepted: boolean;
    duplicate: boolean;
    normalized?: unknown;
    error?: string;
  };

  if (!verified.accepted) {
    return new Response(JSON.stringify({ ok: false, error: verified.error }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (verified.normalized) {
    await options.onVerifiedEvent?.(verified.normalized);
  }

  const event = verified.normalized as { callback?: string } | undefined;
  if (event?.callback === "onVoiceMessage" && options.onVoiceMessage) {
    return options.onVoiceMessage(verified.normalized);
  }

  return new Response(JSON.stringify({ ok: true, duplicate: verified.duplicate }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
