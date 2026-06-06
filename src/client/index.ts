import { createFunctionHandle, type FunctionReference } from "convex/server";

type RunActionCtx = {
  runAction: (reference: unknown, args?: unknown) => Promise<unknown>;
};

type RunQueryCtx = {
  runQuery: (reference: unknown, args?: unknown) => Promise<unknown>;
};

type RunMutationCtx = {
  runMutation: (reference: unknown, args?: unknown) => Promise<unknown>;
};

export type AgentPhoneComponent = Record<string, any>;

export type AgentPhoneCallbackReferences = {
  onMessage?: FunctionReference<"action", "public" | "internal", any, any>;
  onVoiceMessage?: FunctionReference<"action", "public" | "internal", any, any>;
  onCallEnded?: FunctionReference<"action", "public" | "internal", any, any>;
  onReaction?: FunctionReference<"action", "public" | "internal", any, any>;
};

export class AgentPhone {
  constructor(private readonly component: AgentPhoneComponent) {}

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
    return ctx.runAction(this.component.messages.send, args);
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
    return ctx.runAction(this.component.calls.createOutbound, args);
  }

  createWebCall(ctx: RunActionCtx, args: Record<string, unknown>) {
    return ctx.runAction(this.component.calls.createWeb, args);
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

  async registerCallbacks(
    ctx: RunMutationCtx,
    callbacks: AgentPhoneCallbackReferences,
  ) {
    const handles = Object.fromEntries(
      await Promise.all(
        Object.entries(callbacks).map(async ([name, reference]) => [
          name,
          reference ? await createFunctionHandle(reference) : undefined,
        ]),
      ),
    );
    return ctx.runMutation(this.component.webhooks.registerCallbacks, {
      callbacks: handles,
    });
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
