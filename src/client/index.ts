import {
  createFunctionHandle,
  type FunctionReference,
  type GenericActionCtx,
  type GenericDataModel,
  type GenericMutationCtx,
  type GenericQueryCtx,
  httpActionGeneric,
  type HttpRouter,
} from "convex/server";
import { v, type Infer } from "convex/values";
import type { ComponentApi } from "../component/_generated/component.js";
import type { Id } from "../component/_generated/dataModel.js";
import schema from "../component/schema.js";
import {
  agentPhoneEventValidator,
  voiceWebhookResponseValidator,
} from "../component/validators.js";
import type {
  Agent,
  AgentListResponse,
  AgentPhoneEvent,
  CallSummary,
  ConfigureWebhookArgs,
  Conversation,
  ConversationListResponse,
  CreateAgentArgs,
  CreateOutboundCallArgs,
  CreateWebCallArgs,
  DeliveryStatus,
  JsonValue,
  OutboundStatus,
  PhoneNumber,
  PhoneNumberListResponse,
  ProvisionNumberArgs,
  QueueOptions,
  RequestArgs,
  SendMessageArgs,
  SendMessageResult,
  SendStyle,
  StoredEvent,
  SubAccountListResponse,
  SyncPageArgs,
  SyncResult,
  TestModeResult,
  UpdateAgentArgs,
  UsageResponse,
  VoiceWebhookResponse,
  WebCallResult,
  WebhookConfiguration,
} from "./types.js";

export * from "./types.js";
export * from "./auth.js";

export const eventValidator = agentPhoneEventValidator;
export const storedEventValidator = schema.tables.events.validator;
export const voiceResponseValidator = voiceWebhookResponseValidator;
export const agentValidator = schema.tables.agents.validator;
export const numberValidator = schema.tables.numbers.validator;
export const conversationValidator = schema.tables.conversations.validator;
export const messageValidator = schema.tables.messages.validator;
export const callValidator = schema.tables.calls.validator;
export const callTranscriptValidator = schema.tables.callTranscripts.validator;
export const callRecordingValidator = schema.tables.callRecordings.validator;
export const webhookDeliveryValidator =
  schema.tables.webhookDeliveries.validator;
export const outboundRequestValidator =
  schema.tables.outboundRequests.validator;
export const subAccountValidator = schema.tables.subAccounts.validator;

/**
 * Argument validators for a webhook callback. Spread them into the callback's
 * `args` so it keeps accepting everything the component dispatches.
 */
export const eventCallbackArgs = {
  event: agentPhoneEventValidator,
  scope: v.string(),
};

export type Event = Infer<typeof eventValidator>;
export type AgentPhoneAgent = Infer<typeof agentValidator>;
export type AgentPhoneNumber = Infer<typeof numberValidator>;
export type AgentPhoneConversation = Infer<typeof conversationValidator>;
export type AgentPhoneMessage = Infer<typeof messageValidator>;
export type AgentPhoneCall = Infer<typeof callValidator>;
export type AgentPhoneCallTranscript = Infer<typeof callTranscriptValidator>;
export type AgentPhoneCallRecording = Infer<typeof callRecordingValidator>;
export type AgentPhoneWebhookDelivery = Omit<
  Infer<typeof webhookDeliveryValidator>,
  "eventId"
> & { eventId: string };
export type AgentPhoneOutboundRequest = Infer<typeof outboundRequestValidator>;
export type AgentPhoneSubAccount = Infer<typeof subAccountValidator>;
/** A sub-account AgentPhone has already assigned an id to. */
export type AgentPhoneProvisionedSubAccount = Omit<
  AgentPhoneSubAccount,
  "subAccountId" | "status"
> & { subAccountId: string; status: "active" };
export type EventHandler = FunctionReference<
  "mutation",
  "internal",
  { event: AgentPhoneEvent; scope: string },
  VoiceWebhookResponse | null
>;

export interface AgentPhoneOptions {
  AGENTPHONE_API_KEY?: string;
  AGENTPHONE_WEBHOOK_SECRET?: string;
  apiBaseUrl?: string;
  httpPrefix?: string;
  scope?: string;
  subAccountId?: string;
  defaultAgentId?: string;
  defaultNumberId?: string;
  webhookToleranceSeconds?: number;
  testMode?: boolean;
  incomingEventCallback?: EventHandler;
  incomingMessageCallback?: EventHandler;
  reactionCallback?: EventHandler;
  callEndedCallback?: EventHandler;
}

export class AgentPhone {
  public readonly httpPrefix: string;
  public readonly scope: string;
  public readonly subAccountId?: string;
  public readonly defaultAgentId?: string;
  public readonly defaultNumberId?: string;
  public incomingEventCallback?: EventHandler;
  public incomingMessageCallback?: EventHandler;
  public reactionCallback?: EventHandler;
  public callEndedCallback?: EventHandler;

  private readonly options: AgentPhoneOptions;
  private readonly apiKeyOverride?: string;
  private readonly webhookSecretOverride?: string;
  private readonly apiBaseUrl?: string;
  private readonly webhookToleranceSeconds: number;
  private readonly testMode: boolean;

  constructor(
    public readonly componentApi: ComponentApi,
    options: AgentPhoneOptions = {},
  ) {
    this.options = { ...options };
    this.apiKeyOverride = options.AGENTPHONE_API_KEY;
    this.webhookSecretOverride = options.AGENTPHONE_WEBHOOK_SECRET;
    this.apiBaseUrl = options.apiBaseUrl;
    this.httpPrefix = normalizePrefix(options.httpPrefix ?? "/agentphone");
    this.scope = options.scope ?? "default";
    this.subAccountId = options.subAccountId;
    this.defaultAgentId = options.defaultAgentId;
    this.defaultNumberId = options.defaultNumberId;
    this.webhookToleranceSeconds = options.webhookToleranceSeconds ?? 300;
    this.testMode = options.testMode ?? false;
    this.incomingEventCallback = options.incomingEventCallback;
    this.incomingMessageCallback = options.incomingMessageCallback;
    this.reactionCallback = options.reactionCallback;
    this.callEndedCallback = options.callEndedCallback;
  }

  /** Register the signed AgentPhone webhook endpoint on the app's HTTP router. */
  registerRoutes(http: HttpRouter) {
    http.route({
      path: `${this.httpPrefix}/webhook`,
      method: "POST",
      handler: httpActionGeneric(async (ctx, request) => {
        const signature = request.headers.get("X-Webhook-Signature");
        const timestamp = request.headers.get("X-Webhook-Timestamp");
        const deliveryId = request.headers.get("X-Webhook-ID");
        if (!signature || !timestamp || !deliveryId) {
          return jsonResponse(
            { error: "Missing AgentPhone webhook signature headers" },
            400,
          );
        }

        const requestedScope = new URL(request.url).searchParams.get("scope");
        const usesSecretOverride = Boolean(this.webhookSecretOverride);
        if (
          usesSecretOverride &&
          requestedScope !== null &&
          !this.ownsScope(requestedScope)
        ) {
          return jsonResponse(
            { error: "Webhook scope does not match configured scope" },
            403,
          );
        }

        const scope = requestedScope ?? this.scope;
        const rawBody = await request.text();
        const eventType =
          request.headers.get("X-Webhook-Event") ?? readEventType(rawBody);
        const callback = this.callbackFor(eventType);

        try {
          const result = await ctx.runAction(
            this.componentApi.webhooks.handle,
            {
              scope,
              rawBody,
              signature,
              timestamp,
              deliveryId,
              secretOverride: this.webhookSecretOverride,
              toleranceSeconds: this.webhookToleranceSeconds,
              callback: callback && (await createFunctionHandle(callback)),
            },
          );
          if (result.kind === "error") {
            return jsonResponse({ error: result.message }, result.status);
          }

          const callbackResult = isRecord(result.callbackResult)
            ? result.callbackResult
            : {};
          return jsonResponse(callbackResult, 200, {
            "X-AgentPhone-Duplicate": String(result.duplicate),
          });
        } catch (error) {
          console.error("AgentPhone webhook processing failed", error);
          return jsonResponse({ error: "Webhook processing failed" }, 500);
        }
      }),
    });
  }

  /** Configure AgentPhone's project webhook and persist its rotating secret. */
  async configureWebhook(
    ctx: ActionCtx,
    args: ConfigureWebhookArgs | LegacyWebhookArgs = {},
  ): Promise<WebhookConfiguration> {
    const options = normalizeWebhookArgs(args);
    const scope = this.scope;
    return (await ctx.runAction(this.componentApi.webhooks.configure, {
      token: this.apiKey,
      scope,
      url: options.url ?? this.webhookUrl(scope),
      contextLimit: options.contextLimit,
      timeout: options.timeout,
      subAccountId: options.subAccountId ?? this.subAccountId,
      baseUrl: this.apiBaseUrl,
    })) as WebhookConfiguration;
  }

  /** Configure an agent-specific webhook override with its own isolated secret. */
  async configureAgentWebhook(
    ctx: ActionCtx,
    args:
      | (ConfigureWebhookArgs & { agentId: string })
      | (LegacyWebhookArgs & { agent_id: string }),
  ): Promise<WebhookConfiguration> {
    const agentId = "agentId" in args ? args.agentId : args.agent_id;
    const options = normalizeWebhookArgs(args);
    const scope = this.agentScope(agentId);
    return (await ctx.runAction(this.componentApi.webhooks.configure, {
      token: this.apiKey,
      scope,
      url: options.url ?? this.webhookUrl(scope),
      contextLimit: options.contextLimit,
      timeout: options.timeout,
      agentId,
      subAccountId: options.subAccountId ?? this.subAccountId,
      baseUrl: this.apiBaseUrl,
    })) as WebhookConfiguration;
  }

  /** Store a secret for a webhook configured manually in the AgentPhone UI. */
  async setWebhookSecret(
    ctx: MutationCtx | ActionCtx,
    args: { secret: string; scope?: string; agentId?: string },
  ) {
    return await ctx.runMutation(this.componentApi.webhooks.setSecret, {
      scope:
        args.scope ??
        (args.agentId ? this.agentScope(args.agentId) : this.scope),
      secret: args.secret,
      agentId: args.agentId,
      subAccountId: this.subAccountId,
    });
  }

  async removeWebhook(ctx: ActionCtx, args: { agentId?: string } = {}) {
    const scope = args.agentId ? this.agentScope(args.agentId) : this.scope;
    return await ctx.runAction(this.componentApi.webhooks.remove, {
      token: this.apiKey,
      scope,
      agentId: args.agentId,
      subAccountId: this.subAccountId,
      baseUrl: this.apiBaseUrl,
    });
  }

  // Sub-accounts --------------------------------------------------------------

  /**
   * Derive a client bound to one AgentPhone sub-account. Every AgentPhone call
   * it makes carries that sub-account, and its Convex records live under a
   * scope derived from this client's scope, so tenants never share mirrors,
   * webhook secrets, event history, or queue idempotency keys.
   *
   * Agent and number defaults are not inherited: they name resources in the
   * master account, which a sub-account cannot see. Pass the tenant's own
   * defaults instead. Keep `registerRoutes` on the master client; the single
   * webhook route resolves each delivery's scope from its URL.
   */
  forSubAccount(
    subAccount: string | { subAccountId: string },
    options: {
      scope?: string;
      defaultAgentId?: string;
      defaultNumberId?: string;
      testMode?: boolean;
    } = {},
  ): AgentPhone {
    this.assertMasterAccount("forSubAccount");
    const subAccountId =
      typeof subAccount === "string" ? subAccount : subAccount.subAccountId;
    if (!subAccountId) {
      throw new Error("forSubAccount requires a sub-account id");
    }
    return new AgentPhone(this.componentApi, {
      ...this.options,
      AGENTPHONE_WEBHOOK_SECRET: undefined,
      scope: options.scope ?? this.subAccountScope(subAccountId),
      subAccountId,
      defaultAgentId: options.defaultAgentId,
      defaultNumberId: options.defaultNumberId,
      ...(options.testMode !== undefined && { testMode: options.testMode }),
      incomingEventCallback: this.incomingEventCallback,
      incomingMessageCallback: this.incomingMessageCallback,
      reactionCallback: this.reactionCallback,
      callEndedCallback: this.callEndedCallback,
    });
  }

  /** The scope `forSubAccount` binds a sub-account to by default. */
  subAccountScope(subAccountId: string) {
    return `${this.scope}:sub:${subAccountId}`;
  }

  /**
   * Create a sub-account under the master account.
   *
   * Pass `key` — a tenant or workspace ID — to make provisioning idempotent:
   * the component claims the key in a transaction before calling AgentPhone, so
   * concurrent signups and retried actions return the sub-account that already
   * belongs to that key instead of creating a second one.
   */
  async createSubAccount(
    ctx: ActionCtx,
    args: { name: string; key?: string },
  ): Promise<AgentPhoneProvisionedSubAccount> {
    this.assertMasterAccount("createSubAccount");
    return await ctx.runAction(this.componentApi.subAccounts.create, {
      token: this.apiKey,
      scope: this.scope,
      name: args.name,
      key: args.key,
      baseUrl: this.apiBaseUrl,
    });
  }

  /** Rename a sub-account and update its registry entry. */
  async updateSubAccount(
    ctx: ActionCtx,
    args: { subAccountId: string; name: string },
  ): Promise<AgentPhoneProvisionedSubAccount> {
    this.assertMasterAccount("updateSubAccount");
    return await ctx.runAction(this.componentApi.subAccounts.update, {
      token: this.apiKey,
      scope: this.scope,
      subAccountId: args.subAccountId,
      name: args.name,
      baseUrl: this.apiBaseUrl,
    });
  }

  /**
   * Delete a sub-account at AgentPhone and drop its registry entry. Records
   * already mirrored under the sub-account's own scope are left in place.
   */
  async deleteSubAccount(ctx: ActionCtx, args: { subAccountId: string }) {
    this.assertMasterAccount("deleteSubAccount");
    return await ctx.runAction(this.componentApi.subAccounts.remove, {
      token: this.apiKey,
      scope: this.scope,
      subAccountId: args.subAccountId,
      baseUrl: this.apiBaseUrl,
    });
  }

  /** List sub-accounts as AgentPhone reports them. */
  async listSubAccounts(
    ctx: ActionCtx,
    args: { limit?: number; offset?: number; statsDays?: number } = {},
  ) {
    this.assertMasterAccount("listSubAccounts");
    return await this.request<SubAccountListResponse>(ctx, {
      method: "GET",
      path: "sub-accounts",
      query: compactQuery({
        limit: args.limit,
        offset: args.offset,
        stats_days: args.statsDays,
      }),
    });
  }

  /** Reconcile the local sub-account registry with AgentPhone. */
  async syncSubAccounts(
    ctx: ActionCtx,
    args: SyncPageArgs = {},
  ): Promise<SyncResult> {
    this.assertMasterAccount("syncSubAccounts");
    return await ctx.runAction(this.componentApi.sync.subAccounts, {
      token: this.apiKey,
      scope: this.scope,
      baseUrl: this.apiBaseUrl,
      ...args,
    });
  }

  /**
   * Bind a sub-account AgentPhone already holds to this scope, optionally under
   * a tenant key. Use it to onboard sub-accounts created before this component
   * or to resolve a provisioning claim that never settled.
   *
   * Throws rather than reassigning an existing binding: a key that already
   * names another sub-account, or a sub-account that already belongs to another
   * key, has to be deleted or released first.
   */
  async adoptSubAccount(
    ctx: MutationCtx | ActionCtx,
    args: { subAccountId: string; key?: string; name?: string },
  ): Promise<AgentPhoneProvisionedSubAccount> {
    this.assertMasterAccount("adoptSubAccount");
    return await ctx.runMutation(this.componentApi.subAccounts.adopt, {
      scope: this.scope,
      ...args,
    });
  }

  /**
   * Drop an unsettled provisioning claim so its key can be provisioned again.
   * Returns false when the key has no claim or already names a sub-account.
   * Throws while a claim is still live. An expired provisioning claim is
   * demoted to unresolved on the first release (returns false) so a late
   * create can still finish; call again to free the key.
   */
  async releaseSubAccountClaim(
    ctx: MutationCtx | ActionCtx,
    args: { key: string },
  ): Promise<boolean> {
    this.assertMasterAccount("releaseSubAccountClaim");
    return await ctx.runMutation(
      this.componentApi.subAccounts.releaseClaimByKey,
      { scope: this.scope, key: args.key },
    );
  }

  /** Read the sub-account registry reactively. */
  async listLocalSubAccounts(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { limit?: number } = {},
  ): Promise<AgentPhoneSubAccount[]> {
    return await ctx.runQuery(this.componentApi.subAccounts.list, {
      scope: this.scope,
      ...args,
    });
  }

  async getLocalSubAccount(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { key: string } | { subAccountId: string },
  ): Promise<AgentPhoneSubAccount | null> {
    return await ctx.runQuery(this.componentApi.subAccounts.get, {
      scope: this.scope,
      ...args,
    });
  }

  /** Escape hatch for current and future JSON AgentPhone API endpoints. */
  async request<T = JsonValue | null>(ctx: ActionCtx, args: RequestArgs) {
    return (await ctx.runAction(this.componentApi.request.request, {
      token: this.apiKey,
      method: args.method,
      path: args.path,
      query: args.query,
      body: args.body,
      subAccountId: args.subAccountId ?? this.subAccountId,
      baseUrl: this.apiBaseUrl,
    })) as T;
  }

  async sendMessage(
    ctx: ActionCtx,
    args: (SendMessageArgs & { testMode?: boolean }) | LegacyMessageArgs,
  ): Promise<SendMessageResult | TestModeResult> {
    const input = normalizeMessageArgs(args);
    const testMode = input.testMode ?? this.testMode;
    return (await ctx.runAction(this.componentApi.messages.send, {
      token: this.apiKeyFor(testMode),
      scope: this.scope,
      subAccountId: this.subAccountId,
      baseUrl: this.apiBaseUrl,
      agentId: input.agentId ?? this.defaultAgentId,
      toNumber: input.toNumber,
      recipients: input.recipients,
      body: input.body,
      mediaUrls: input.mediaUrls,
      numberId: input.numberId ?? this.defaultNumberId,
      fromNumber: input.fromNumber,
      channel: input.channel,
      sendStyle: input.sendStyle,
      replyToMessageId: input.replyToMessageId,
      buttons: input.buttons,
      list: input.list,
      testMode,
    })) as SendMessageResult | TestModeResult;
  }

  async sendReaction(
    ctx: ActionCtx,
    args: MessageIdArg & { reaction: string },
  ) {
    const messageId = messageIdFrom(args);
    return await this.request(ctx, {
      method: "POST",
      path: `messages/${encodeURIComponent(messageId)}/reactions`,
      body: { reaction: args.reaction },
    });
  }

  async createOutboundCall(
    ctx: ActionCtx,
    args:
      | (CreateOutboundCallArgs & { testMode?: boolean })
      | LegacyOutboundCallArgs,
  ): Promise<CallSummary | TestModeResult> {
    const input = normalizeOutboundCallArgs(args);
    const agentId = input.agentId ?? this.defaultAgentId;
    const testMode = input.testMode ?? this.testMode;
    if (!agentId) {
      throw new Error("createOutboundCall requires agentId or defaultAgentId");
    }
    return (await ctx.runAction(this.componentApi.calls.createOutbound, {
      agentId,
      toNumber: input.toNumber,
      fromNumberId: input.fromNumberId,
      initialGreeting: input.initialGreeting,
      voice: input.voice,
      systemPrompt: input.systemPrompt,
      modelTier: input.modelTier,
      variables: input.variables,
      callScreeningIdentity: input.callScreeningIdentity,
      callScreeningPurpose: input.callScreeningPurpose,
      testMode,
      token: this.apiKeyFor(testMode),
      scope: this.scope,
      subAccountId: this.subAccountId,
      baseUrl: this.apiBaseUrl,
    })) as CallSummary | TestModeResult;
  }

  async createWebCall(
    ctx: ActionCtx,
    args: (CreateWebCallArgs & { testMode?: boolean }) | LegacyWebCallArgs,
  ): Promise<WebCallResult | TestModeResult> {
    const input = normalizeWebCallArgs(args);
    const agentId = input.agentId ?? this.defaultAgentId;
    const testMode = input.testMode ?? this.testMode;
    if (!agentId) {
      throw new Error("createWebCall requires agentId or defaultAgentId");
    }
    return (await ctx.runAction(this.componentApi.calls.createWeb, {
      agentId,
      metadata: input.metadata,
      variables: input.variables,
      testMode,
      token: this.apiKeyFor(testMode),
      scope: this.scope,
      subAccountId: this.subAccountId,
      baseUrl: this.apiBaseUrl,
    })) as WebCallResult | TestModeResult;
  }

  async endCall(ctx: ActionCtx, args: CallIdArg) {
    return (await ctx.runAction(this.componentApi.calls.end, {
      callId: callIdFrom(args),
      token: this.apiKey,
      scope: this.scope,
      subAccountId: this.subAccountId,
      baseUrl: this.apiBaseUrl,
    })) as CallSummary;
  }

  async listCalls(
    ctx: ActionCtx,
    args: {
      limit?: number;
      offset?: number;
      status?: string;
      direction?: "inbound" | "outbound" | "web";
      search?: string;
    } = {},
  ) {
    return await this.request<{ data?: CallSummary[]; calls?: CallSummary[] }>(
      ctx,
      {
        method: "GET",
        path: "calls",
        query: args,
      },
    );
  }

  async getCall(ctx: ActionCtx, args: CallIdArg) {
    return await this.request<CallSummary>(ctx, {
      method: "GET",
      path: `calls/${encodeURIComponent(callIdFrom(args))}`,
    });
  }

  async getCallTranscript(ctx: ActionCtx, args: CallIdArg) {
    return (await ctx.runAction(this.componentApi.calls.getTranscript, {
      callId: callIdFrom(args),
      token: this.apiKey,
      scope: this.scope,
      subAccountId: this.subAccountId,
      baseUrl: this.apiBaseUrl,
    })) as JsonValue;
  }

  async getCallRecording(ctx: ActionCtx, args: CallIdArg) {
    return (await ctx.runAction(this.componentApi.calls.getRecording, {
      callId: callIdFrom(args),
      token: this.apiKey,
      scope: this.scope,
      subAccountId: this.subAccountId,
      baseUrl: this.apiBaseUrl,
    })) as JsonValue | string;
  }

  async listCallsForNumber(
    ctx: ActionCtx,
    args:
      | { numberId: string; limit?: number; offset?: number }
      | { number_id: string; limit?: number; offset?: number },
  ) {
    const numberId = numberIdFrom(args);
    return await this.request(ctx, {
      method: "GET",
      path: `numbers/${encodeURIComponent(numberId)}/calls`,
      query: compactQuery({ limit: args.limit, offset: args.offset }),
    });
  }

  async listAgents(ctx: ActionCtx, args: { offset?: number } = {}) {
    return await this.request<AgentListResponse>(ctx, {
      method: "GET",
      path: "agents",
      query: args,
    });
  }

  async getAgent(ctx: ActionCtx, args: AgentIdArg) {
    return await this.request<Agent>(ctx, {
      method: "GET",
      path: `agents/${encodeURIComponent(agentIdFrom(args))}`,
    });
  }

  async createAgent(ctx: ActionCtx, args: CreateAgentArgs) {
    return await this.request<Agent>(ctx, {
      method: "POST",
      path: "agents",
      body: args as unknown as JsonValue,
    });
  }

  async deleteAgent(ctx: ActionCtx, args: AgentIdArg) {
    return await this.request(ctx, {
      method: "DELETE",
      path: `agents/${encodeURIComponent(agentIdFrom(args))}`,
    });
  }

  async listVoices(ctx: ActionCtx) {
    return await this.request(ctx, { method: "GET", path: "agents/voices" });
  }

  async listAgentConversations(
    ctx: ActionCtx,
    args:
      | { agentId: string; limit?: number; offset?: number }
      | { agent_id: string; limit?: number; offset?: number },
  ) {
    const agentId = agentIdFrom(args);
    return await this.request(ctx, {
      method: "GET",
      path: `agents/${encodeURIComponent(agentId)}/conversations`,
      query: compactQuery({ limit: args.limit, offset: args.offset }),
    });
  }

  async listAgentCalls(
    ctx: ActionCtx,
    args:
      | { agentId: string; limit?: number; offset?: number }
      | { agent_id: string; limit?: number; offset?: number },
  ) {
    const agentId = agentIdFrom(args);
    return await this.request(ctx, {
      method: "GET",
      path: `agents/${encodeURIComponent(agentId)}/calls`,
      query: compactQuery({ limit: args.limit, offset: args.offset }),
    });
  }

  async updateAgent(
    ctx: ActionCtx,
    args:
      | (UpdateAgentArgs & { agentId: string })
      | (UpdateAgentArgs & { agent_id: string }),
  ) {
    const agentId = agentIdFrom(args);
    const {
      agentId: _camelId,
      agent_id: _snakeId,
      ...body
    } = args as UpdateAgentArgs & {
      agentId?: string;
      agent_id?: string;
    };
    return await this.request<Agent>(ctx, {
      method: "PATCH",
      path: `agents/${encodeURIComponent(agentId)}`,
      body: body as unknown as JsonValue,
    });
  }

  async listNumbers(ctx: ActionCtx, args: { offset?: number } = {}) {
    return await this.request<PhoneNumberListResponse>(ctx, {
      method: "GET",
      path: "numbers",
      query: args,
    });
  }

  async getNumber(ctx: ActionCtx, args: NumberIdArg) {
    return await this.request<PhoneNumber>(ctx, {
      method: "GET",
      path: `numbers/${encodeURIComponent(numberIdFrom(args))}`,
    });
  }

  async provisionNumber(ctx: ActionCtx, args: ProvisionNumberArgs = {}) {
    return await this.request<PhoneNumber>(ctx, {
      method: "POST",
      path: "numbers",
      body: args as unknown as JsonValue,
    });
  }

  async releaseNumber(ctx: ActionCtx, args: NumberIdArg) {
    return await this.request(ctx, {
      method: "DELETE",
      path: `numbers/${encodeURIComponent(numberIdFrom(args))}`,
    });
  }

  async listNumberMessages(
    ctx: ActionCtx,
    args: {
      limit?: number;
      before?: string;
      after?: string;
    } & NumberIdArg,
  ) {
    const numberId = numberIdFrom(args);
    return await this.request(ctx, {
      method: "GET",
      path: `numbers/${encodeURIComponent(numberId)}/messages`,
      query: compactQuery({
        limit: args.limit,
        before: args.before,
        after: args.after,
      }),
    });
  }

  async attachNumberToAgent(
    ctx: ActionCtx,
    args:
      | { agentId: string; numberId: string }
      | { agent_id: string; number_id: string },
  ) {
    const agentId = agentIdFrom(args);
    const numberId = numberIdFrom(args);
    return await this.request(ctx, {
      method: "POST",
      path: `agents/${encodeURIComponent(agentId)}/numbers`,
      body: { numberId },
    });
  }

  async detachNumberFromAgent(
    ctx: ActionCtx,
    args:
      | { agentId: string; numberId: string }
      | { agent_id: string; number_id: string },
  ) {
    const agentId = agentIdFrom(args);
    const numberId = numberIdFrom(args);
    return await this.request(ctx, {
      method: "DELETE",
      path: `agents/${encodeURIComponent(agentId)}/numbers/${encodeURIComponent(numberId)}`,
    });
  }

  async listConversations(
    ctx: ActionCtx,
    args: { limit?: number; offset?: number } = {},
  ) {
    return await this.request<ConversationListResponse>(ctx, {
      method: "GET",
      path: "conversations",
      query: args,
    });
  }

  async getConversation(ctx: ActionCtx, args: ConversationIdArg) {
    return await this.request<Conversation>(ctx, {
      method: "GET",
      path: `conversations/${encodeURIComponent(conversationIdFrom(args))}`,
    });
  }

  async listConversationMessages(
    ctx: ActionCtx,
    args: {
      limit?: number;
      before?: string;
      after?: string;
    } & ConversationIdArg,
  ) {
    const conversationId = conversationIdFrom(args);
    return await this.request(ctx, {
      method: "GET",
      path: `conversations/${encodeURIComponent(conversationId)}/messages`,
      query: compactQuery({
        limit: args.limit,
        before: args.before,
        after: args.after,
      }),
    });
  }

  async sendTypingIndicator(ctx: ActionCtx, args: ConversationIdArg) {
    return await this.request(ctx, {
      method: "POST",
      path: `conversations/${encodeURIComponent(conversationIdFrom(args))}/typing`,
    });
  }

  async updateConversation(
    ctx: ActionCtx,
    args: ConversationIdArg & {
      metadata?: JsonValue | null;
      groupName?: string | null;
      group_name?: string | null;
    },
  ) {
    const conversationId = conversationIdFrom(args);
    return await this.request<Conversation>(ctx, {
      method: "PATCH",
      path: `conversations/${encodeURIComponent(conversationId)}`,
      body: {
        ...(args.metadata !== undefined && { metadata: args.metadata }),
        ...((args.groupName ?? args.group_name) !== undefined && {
          group_name: args.groupName ?? args.group_name,
        }),
      },
    });
  }

  async getUsage(ctx: ActionCtx) {
    return await this.request<UsageResponse>(ctx, {
      method: "GET",
      path: "usage",
    });
  }

  async getDailyUsage(ctx: ActionCtx, args: { days?: number } = {}) {
    return await this.request(ctx, {
      method: "GET",
      path: "usage/daily",
      query: args,
    });
  }

  async getMonthlyUsage(ctx: ActionCtx, args: { months?: number } = {}) {
    return await this.request(ctx, {
      method: "GET",
      path: "usage/monthly",
      query: args,
    });
  }

  async getUsageByNumber(ctx: ActionCtx) {
    return await this.request(ctx, {
      method: "GET",
      path: "usage/by-number",
    });
  }

  async getUsageByAgent(
    ctx: ActionCtx,
    args: { period?: "week" | "month" | "year" } = {},
  ) {
    return await this.request(ctx, {
      method: "GET",
      path: "usage/by-agent",
      query: args,
    });
  }

  async testWebhook(ctx: ActionCtx, args: { agentId?: string } = {}) {
    const path = args.agentId
      ? `agents/${encodeURIComponent(args.agentId)}/webhook/test`
      : "webhooks/test";
    return await this.request(ctx, { method: "POST", path });
  }

  /** Compatibility name for project-level webhook configuration. */
  async configureProjectWebhook(
    ctx: ActionCtx,
    args: ConfigureWebhookArgs | LegacyWebhookArgs = {},
  ) {
    return await this.configureWebhook(ctx, args);
  }

  async getProjectWebhook(ctx: ActionCtx) {
    return await this.request(ctx, { method: "GET", path: "webhooks" });
  }

  async deleteProjectWebhook(ctx: ActionCtx) {
    return await this.removeWebhook(ctx);
  }

  async testProjectWebhook(ctx: ActionCtx, args: { agentId?: string } = {}) {
    return await this.request(ctx, {
      method: "POST",
      path: "webhooks/test",
      query: args,
    });
  }

  async getAgentWebhook(ctx: ActionCtx, args: AgentIdArg) {
    return await this.request(ctx, {
      method: "GET",
      path: `agents/${encodeURIComponent(agentIdFrom(args))}/webhook`,
    });
  }

  async deleteAgentWebhook(ctx: ActionCtx, args: AgentIdArg) {
    return await this.removeWebhook(ctx, { agentId: agentIdFrom(args) });
  }

  async listAgentWebhookDeliveries(
    ctx: ActionCtx,
    args:
      | { agentId: string; limit?: number; offset?: number }
      | { agent_id: string; limit?: number; offset?: number },
  ) {
    const agentId = agentIdFrom(args);
    return await this.request(ctx, {
      method: "GET",
      path: `agents/${encodeURIComponent(agentId)}/webhook/deliveries`,
      query: compactQuery({ limit: args.limit, offset: args.offset }),
    });
  }

  async testAgentWebhook(ctx: ActionCtx, args: AgentIdArg) {
    return await this.request(ctx, {
      method: "POST",
      path: `agents/${encodeURIComponent(agentIdFrom(args))}/webhook/test`,
    });
  }

  async listProviderWebhookDeliveries(
    ctx: ActionCtx,
    args: { limit?: number; offset?: number } = {},
  ) {
    return await this.request(ctx, {
      method: "GET",
      path: "webhooks/deliveries",
      query: args,
    });
  }

  async getWebhookDeliveryStats(ctx: ActionCtx, args: { hours?: number } = {}) {
    return await this.request(ctx, {
      method: "GET",
      path: "webhooks/deliveries/stats",
      query: args,
    });
  }

  async getWebhookAllTimeStats(ctx: ActionCtx) {
    return await this.request(ctx, {
      method: "GET",
      path: "webhooks/deliveries/all-time",
    });
  }

  async list(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { limit?: number } = {},
  ): Promise<StoredEvent[]> {
    return await this.listEvents(ctx, args);
  }

  async listEvents(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { limit?: number } = {},
  ): Promise<StoredEvent[]> {
    return await ctx.runQuery(this.componentApi.events.list, {
      scope: this.scope,
      limit: args.limit,
    });
  }

  async listIncoming(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { limit?: number } = {},
  ): Promise<StoredEvent[]> {
    return await ctx.runQuery(this.componentApi.events.listBySource, {
      scope: this.scope,
      source: "webhook",
      limit: args.limit,
    });
  }

  async listOutgoing(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { limit?: number } = {},
  ): Promise<StoredEvent[]> {
    return await ctx.runQuery(this.componentApi.events.listBySource, {
      scope: this.scope,
      source: "api",
      limit: args.limit,
    });
  }

  async listEventsByType(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { eventType: string; limit?: number },
  ): Promise<StoredEvent[]> {
    return await ctx.runQuery(this.componentApi.events.listByType, {
      ...args,
      scope: this.scope,
    });
  }

  async listEventsByAgent(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { agentId: string; limit?: number },
  ): Promise<StoredEvent[]> {
    return await ctx.runQuery(this.componentApi.events.listByAgent, {
      ...args,
      scope: this.scope,
    });
  }

  async listEventsByNumber(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { numberId: string; limit?: number },
  ): Promise<StoredEvent[]> {
    return await ctx.runQuery(this.componentApi.events.listByNumber, {
      ...args,
      scope: this.scope,
    });
  }

  async listEventsByConversation(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { conversationId: string; limit?: number },
  ): Promise<StoredEvent[]> {
    return await ctx.runQuery(this.componentApi.events.listByConversation, {
      ...args,
      scope: this.scope,
    });
  }

  async listEventsByCall(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { callId: string; limit?: number },
  ): Promise<StoredEvent[]> {
    return await ctx.runQuery(this.componentApi.events.listByCall, {
      ...args,
      scope: this.scope,
    });
  }

  async getEventByDeliveryId(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { deliveryId: string },
  ): Promise<StoredEvent | null> {
    return await ctx.runQuery(this.componentApi.events.getByDeliveryId, {
      scope: this.scope,
      deliveryId: args.deliveryId,
    });
  }

  // Reactive resource mirrors -------------------------------------------------

  async listLocalAgents(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { limit?: number } = {},
  ): Promise<AgentPhoneAgent[]> {
    return await ctx.runQuery(this.componentApi.resources.listAgents, {
      scope: this.scope,
      ...args,
    });
  }

  async getLocalAgent(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { agentId: string },
  ): Promise<AgentPhoneAgent | null> {
    return await ctx.runQuery(this.componentApi.resources.getAgent, {
      scope: this.scope,
      ...args,
    });
  }

  async listLocalNumbers(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { limit?: number } = {},
  ): Promise<AgentPhoneNumber[]> {
    return await ctx.runQuery(this.componentApi.resources.listNumbers, {
      scope: this.scope,
      ...args,
    });
  }

  async getLocalNumber(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { numberId: string },
  ): Promise<AgentPhoneNumber | null> {
    return await ctx.runQuery(this.componentApi.resources.getNumber, {
      scope: this.scope,
      ...args,
    });
  }

  async listLocalConversations(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: {
      agentId?: string;
      numberId?: string;
      counterparty?: string;
      limit?: number;
    } = {},
  ): Promise<AgentPhoneConversation[]> {
    return await ctx.runQuery(this.componentApi.resources.listConversations, {
      scope: this.scope,
      ...args,
    });
  }

  async getLocalConversation(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { conversationId: string },
  ): Promise<AgentPhoneConversation | null> {
    return await ctx.runQuery(this.componentApi.resources.getConversation, {
      scope: this.scope,
      ...args,
    });
  }

  async listLocalMessagesByConversation(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { conversationId: string; limit?: number },
  ): Promise<AgentPhoneMessage[]> {
    return await ctx.runQuery(
      this.componentApi.resources.listMessagesByConversation,
      { scope: this.scope, ...args },
    );
  }

  async listLocalMessagesByAgent(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { agentId: string; limit?: number },
  ): Promise<AgentPhoneMessage[]> {
    return await ctx.runQuery(this.componentApi.resources.listMessagesByAgent, {
      scope: this.scope,
      ...args,
    });
  }

  async listLocalMessagesByNumber(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { numberId: string; limit?: number },
  ): Promise<AgentPhoneMessage[]> {
    return await ctx.runQuery(
      this.componentApi.resources.listMessagesByNumber,
      { scope: this.scope, ...args },
    );
  }

  async listLocalMessagesByCounterparty(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { counterparty: string; limit?: number },
  ): Promise<AgentPhoneMessage[]> {
    return await ctx.runQuery(
      this.componentApi.resources.listMessagesByCounterparty,
      { scope: this.scope, ...args },
    );
  }

  /** @deprecated Use listLocalMessagesByConversation. */
  async listMessagesByConversation(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { conversationId: string; limit?: number },
  ) {
    return await this.listLocalMessagesByConversation(ctx, args);
  }

  /** @deprecated Use listLocalMessagesByAgent. */
  async listMessagesByAgent(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { agentId: string; limit?: number },
  ) {
    return await this.listLocalMessagesByAgent(ctx, args);
  }

  /** @deprecated Use listLocalMessagesByNumber. */
  async listMessagesByNumber(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { numberId: string; limit?: number },
  ) {
    return await this.listLocalMessagesByNumber(ctx, args);
  }

  /** @deprecated Use listLocalMessagesByCounterparty. */
  async listMessagesByCounterparty(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { counterparty: string; limit?: number },
  ) {
    return await this.listLocalMessagesByCounterparty(ctx, args);
  }

  async listLocalCallsByAgent(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { agentId: string; limit?: number },
  ): Promise<AgentPhoneCall[]> {
    return await ctx.runQuery(this.componentApi.resources.listCallsByAgent, {
      scope: this.scope,
      ...args,
    });
  }

  async listLocalCallsByNumber(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { numberId: string; limit?: number },
  ): Promise<AgentPhoneCall[]> {
    return await ctx.runQuery(this.componentApi.resources.listCallsByNumber, {
      scope: this.scope,
      ...args,
    });
  }

  /** @deprecated Use listLocalCallsByAgent. */
  async listCallsByAgent(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { agentId: string; limit?: number },
  ) {
    return await this.listLocalCallsByAgent(ctx, args);
  }

  /** @deprecated Use listLocalCallsByNumber. */
  async listCallsByNumber(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { numberId: string; limit?: number },
  ) {
    return await this.listLocalCallsByNumber(ctx, args);
  }

  async getLatestConversationState(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { conversationId: string; messageLimit?: number },
  ) {
    return await ctx.runQuery(
      this.componentApi.resources.getLatestConversationState,
      { scope: this.scope, ...args },
    );
  }

  async getLocalCallTranscript(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { callId: string },
  ): Promise<AgentPhoneCallTranscript | null> {
    return await ctx.runQuery(this.componentApi.resources.getCallTranscript, {
      scope: this.scope,
      ...args,
    });
  }

  async getLocalCallRecording(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { callId: string },
  ): Promise<AgentPhoneCallRecording | null> {
    return await ctx.runQuery(this.componentApi.resources.getCallRecording, {
      scope: this.scope,
      ...args,
    });
  }

  // Explicit provider-to-Convex backfill -------------------------------------

  async syncAgents(
    ctx: ActionCtx,
    args: SyncPageArgs = {},
  ): Promise<SyncResult> {
    return await ctx.runAction(this.componentApi.sync.agents, {
      ...this.syncConnection,
      ...args,
    });
  }

  async syncNumbers(
    ctx: ActionCtx,
    args: SyncPageArgs = {},
  ): Promise<SyncResult> {
    return await ctx.runAction(this.componentApi.sync.numbers, {
      ...this.syncConnection,
      ...args,
    });
  }

  async syncConversations(
    ctx: ActionCtx,
    args: SyncPageArgs & { agentId?: string; numberId?: string } = {},
  ): Promise<SyncResult> {
    return await ctx.runAction(this.componentApi.sync.conversations, {
      ...this.syncConnection,
      ...args,
    });
  }

  async syncMessages(
    ctx: ActionCtx,
    args: {
      conversationId?: string;
      numberId?: string;
      limit?: number;
      before?: string;
      after?: string;
    },
  ): Promise<SyncResult> {
    return await ctx.runAction(this.componentApi.sync.messages, {
      ...this.syncConnection,
      ...args,
    });
  }

  async syncCalls(
    ctx: ActionCtx,
    args: SyncPageArgs & {
      agentId?: string;
      numberId?: string;
      status?: string;
      direction?: string;
      search?: string;
    } = {},
  ): Promise<SyncResult> {
    return await ctx.runAction(this.componentApi.sync.calls, {
      ...this.syncConnection,
      ...args,
    });
  }

  /** Compatibility alias for the 0.2 client. */
  async syncRecentConversations(
    ctx: ActionCtx,
    args: SyncPageArgs & {
      agent_id?: string;
      number_id?: string;
    } = {},
  ) {
    return await this.syncConversations(ctx, {
      limit: args.limit,
      offset: args.offset,
      agentId: args.agent_id,
      numberId: args.number_id,
    });
  }

  /** Compatibility alias for the 0.2 client. */
  async syncRecentMessages(
    ctx: ActionCtx,
    args: {
      conversation_id?: string;
      number_id?: string;
      limit?: number;
      before?: string;
      after?: string;
    },
  ) {
    return await this.syncMessages(ctx, {
      conversationId: args.conversation_id,
      numberId: args.number_id,
      limit: args.limit,
      before: args.before,
      after: args.after,
    });
  }

  /** Compatibility alias for the 0.2 client. */
  async syncRecentCalls(
    ctx: ActionCtx,
    args: SyncPageArgs & {
      agent_id?: string;
      number_id?: string;
      status?: string;
      direction?: string;
      search?: string;
    } = {},
  ) {
    return await this.syncCalls(ctx, {
      limit: args.limit,
      offset: args.offset,
      agentId: args.agent_id,
      numberId: args.number_id,
      status: args.status,
      direction: args.direction,
      search: args.search,
    });
  }

  async reconcileWebhookConfig(
    ctx: ActionCtx,
    args: { agent_id?: string } = {},
  ) {
    return args.agent_id
      ? await this.getAgentWebhook(ctx, { agentId: args.agent_id })
      : await this.getProjectWebhook(ctx);
  }

  // Durable outbound ----------------------------------------------------------

  async enqueueMessage(
    ctx: MutationCtx | ActionCtx,
    args: (SendMessageArgs & QueueOptions) | LegacyMessageArgs,
  ) {
    const input = normalizeMessageArgs(args);
    return await ctx.runMutation(this.componentApi.outbound.enqueueMessage, {
      ...input,
      scope: this.scope,
      agentId: input.agentId ?? this.defaultAgentId,
      numberId: input.numberId ?? this.defaultNumberId,
      subAccountId: this.subAccountId,
      baseUrl: this.apiBaseUrl,
      testMode: input.testMode ?? this.testMode,
    });
  }

  async enqueueOutboundCall(
    ctx: MutationCtx | ActionCtx,
    args: (CreateOutboundCallArgs & QueueOptions) | LegacyOutboundCallArgs,
  ) {
    const input = normalizeOutboundCallArgs(args);
    const agentId = input.agentId ?? this.defaultAgentId;
    if (!agentId) {
      throw new Error("enqueueOutboundCall requires agentId or defaultAgentId");
    }
    return await ctx.runMutation(
      this.componentApi.outbound.enqueueOutboundCall,
      {
        ...input,
        agentId,
        scope: this.scope,
        subAccountId: this.subAccountId,
        baseUrl: this.apiBaseUrl,
        testMode: input.testMode ?? this.testMode,
      },
    );
  }

  async enqueueWebCall(
    ctx: MutationCtx | ActionCtx,
    args: (CreateWebCallArgs & QueueOptions) | LegacyWebCallArgs,
  ) {
    const input = normalizeWebCallArgs(args);
    const agentId = input.agentId ?? this.defaultAgentId;
    if (!agentId) {
      throw new Error("enqueueWebCall requires agentId or defaultAgentId");
    }
    return await ctx.runMutation(this.componentApi.outbound.enqueueWebCall, {
      ...input,
      agentId,
      scope: this.scope,
      subAccountId: this.subAccountId,
      baseUrl: this.apiBaseUrl,
      testMode: input.testMode ?? this.testMode,
    });
  }

  async getOutboundStatus(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { requestId: string },
  ): Promise<AgentPhoneOutboundRequest | null> {
    return await ctx.runQuery(this.componentApi.outbound.getStatus, {
      scope: this.scope,
      requestId: args.requestId as Id<"outboundRequests">,
    });
  }

  async listOutboundRequests(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { status?: OutboundStatus; agentId?: string; limit?: number } = {},
  ): Promise<AgentPhoneOutboundRequest[]> {
    return await ctx.runQuery(this.componentApi.outbound.listRequests, {
      scope: this.scope,
      ...args,
    });
  }

  async cancelOutboundRequest(
    ctx: MutationCtx | ActionCtx,
    args: { requestId: string },
  ) {
    return await ctx.runMutation(this.componentApi.outbound.cancel, {
      scope: this.scope,
      requestId: args.requestId as Id<"outboundRequests">,
    });
  }

  // Webhook delivery operations ----------------------------------------------

  async listWebhookDeliveries(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { status?: DeliveryStatus; agentId?: string; limit?: number } = {},
  ): Promise<AgentPhoneWebhookDelivery[]> {
    return await ctx.runQuery(this.componentApi.deliveries.list, {
      scope: this.scope,
      ...args,
    });
  }

  async listFailedWebhookDeliveries(
    ctx: QueryCtx | MutationCtx | ActionCtx,
    args: { limit?: number } = {},
  ): Promise<AgentPhoneWebhookDelivery[]> {
    return await ctx.runQuery(this.componentApi.deliveries.listFailed, {
      scope: this.scope,
      ...args,
    });
  }

  async replayWebhookDelivery(
    ctx: ActionCtx,
    args: { deliveryId: string } | { webhookId: string },
  ) {
    const deliveryId = "deliveryId" in args ? args.deliveryId : args.webhookId;
    return await ctx.runAction(this.componentApi.deliveries.replay, {
      scope: this.scope,
      deliveryId,
    });
  }

  async cleanupWebhookDeliveries(
    ctx: MutationCtx | ActionCtx,
    args:
      | { olderThan: number; limit?: number }
      | { olderThanMs?: number; limit?: number; statuses?: string[] },
  ) {
    const olderThan =
      "olderThan" in args
        ? args.olderThan
        : Date.now() - (args.olderThanMs ?? 30 * 24 * 60 * 60 * 1000);
    const statuses =
      "statuses" in args ? args.statuses?.filter(isDeliveryStatus) : undefined;
    return await ctx.runMutation(this.componentApi.deliveries.cleanup, {
      scope: this.scope,
      olderThan,
      limit: args.limit,
      statuses,
    });
  }

  private get apiKey() {
    const value = this.apiKeyOverride ?? process.env.AGENTPHONE_API_KEY;
    if (!value) {
      throw new Error(
        "Missing AgentPhone API key. Run: npx convex env set AGENTPHONE_API_KEY=your_key",
      );
    }
    return value;
  }

  private apiKeyFor(testMode: boolean) {
    return testMode ? "agentphone_test_mode" : this.apiKey;
  }

  /**
   * Sub-account management belongs to the master account: AgentPhone allows a
   * single level of nesting, and a sub-account cannot see or create others.
   */
  private assertMasterAccount(method: string) {
    if (this.subAccountId) {
      throw new Error(
        `${method} is a master-account operation, but this client is bound to sub-account ${this.subAccountId}. Call it on the master client that created the sub-account.`,
      );
    }
  }

  private get syncConnection() {
    return {
      token: this.apiKey,
      scope: this.scope,
      subAccountId: this.subAccountId,
      baseUrl: this.apiBaseUrl,
    };
  }

  private callbackFor(eventType: string | undefined) {
    if (eventType === "agent.message") {
      return this.incomingMessageCallback ?? this.incomingEventCallback;
    }
    if (eventType === "agent.reaction") {
      return this.reactionCallback ?? this.incomingEventCallback;
    }
    if (eventType === "agent.call_ended") {
      return this.callEndedCallback ?? this.incomingEventCallback;
    }
    return this.incomingEventCallback;
  }

  private webhookUrl(scope: string) {
    const siteUrl = process.env.CONVEX_SITE_URL;
    if (!siteUrl) {
      throw new Error(
        "CONVEX_SITE_URL is required to configure AgentPhone webhooks",
      );
    }
    const url = new URL(
      `${this.httpPrefix}/webhook`,
      ensureTrailingSlash(siteUrl),
    );
    url.searchParams.set("scope", scope);
    return url.toString();
  }

  private agentScope(agentId: string) {
    return `${this.scope}:agent:${agentId}`;
  }

  /**
   * Whether a webhook query scope belongs to this client: its own scope, or any
   * scope derived from it by `forSubAccount` or `configureAgentWebhook`.
   */
  private ownsScope(scope: string) {
    let candidate: string | null = scope;
    while (candidate !== null) {
      if (candidate === this.scope) {
        return true;
      }
      candidate = parentScope(candidate);
    }
    return false;
  }
}

export default AgentPhone;

declare global {
  const Convex: Record<string, unknown>;
}

if (typeof Convex === "undefined") {
  throw new Error(
    "agentphone-convex is Convex backend code and cannot run in the browser",
  );
}

type QueryCtx = Pick<GenericQueryCtx<GenericDataModel>, "runQuery">;
type MutationCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;
type ActionCtx = Pick<
  GenericActionCtx<GenericDataModel>,
  "runQuery" | "runMutation" | "runAction"
>;

type LegacyWebhookArgs = {
  url?: string;
  context_limit?: number;
  timeout_ms?: number;
  sub_account_id?: string;
};

type AgentIdArg = { agentId: string } | { agent_id: string };
type NumberIdArg = { numberId: string } | { number_id: string };
type ConversationIdArg =
  | { conversationId: string }
  | { conversation_id: string };
type CallIdArg = { callId: string } | { call_id: string };
type MessageIdArg = { messageId: string } | { message_id: string };

type LegacyMessageArgs = {
  agent_id?: string;
  to_number?: string;
  recipients?: string[];
  body?: string;
  media_urls?: string[];
  number_id?: string;
  from_number?: string;
  channel?: "sms" | "imessage" | "whatsapp";
  send_style?: SendStyle;
  reply_to_message_id?: string;
  buttons?: string[];
  list?: JsonValue;
  idempotency_key?: string;
  max_attempts?: number;
  test_mode?: boolean;
};

type LegacyOutboundCallArgs = {
  agent_id?: string;
  to_number: string;
  from_number_id?: string;
  initial_greeting?: string;
  voice?: string;
  system_prompt?: string;
  model_tier?: "turbo" | "balanced" | "max";
  variables?: Record<string, string>;
  call_screening_identity?: string;
  call_screening_purpose?: string;
  idempotency_key?: string;
  max_attempts?: number;
  test_mode?: boolean;
};

type LegacyWebCallArgs = {
  agent_id?: string;
  metadata?: JsonValue;
  variables?: Record<string, string>;
  idempotency_key?: string;
  max_attempts?: number;
  test_mode?: boolean;
};

function agentIdFrom(args: AgentIdArg) {
  return "agentId" in args ? args.agentId : args.agent_id;
}

function numberIdFrom(args: NumberIdArg) {
  return "numberId" in args ? args.numberId : args.number_id;
}

function conversationIdFrom(args: ConversationIdArg) {
  return "conversationId" in args ? args.conversationId : args.conversation_id;
}

function callIdFrom(args: CallIdArg) {
  return "callId" in args ? args.callId : args.call_id;
}

function messageIdFrom(args: MessageIdArg) {
  return "messageId" in args ? args.messageId : args.message_id;
}

function compactQuery(
  value: Record<string, string | number | boolean | null | undefined>,
) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Record<string, string | number | boolean | null>;
}

function normalizeMessageArgs(
  args: SendMessageArgs | LegacyMessageArgs,
): SendMessageArgs & QueueOptions {
  if ("agent_id" in args || "to_number" in args || "idempotency_key" in args) {
    return {
      agentId: args.agent_id,
      toNumber: args.to_number,
      recipients: args.recipients,
      body: args.body ?? "",
      mediaUrls: args.media_urls,
      numberId: args.number_id,
      fromNumber: args.from_number,
      channel: args.channel === "whatsapp" ? "whatsapp" : undefined,
      sendStyle: args.send_style,
      replyToMessageId: args.reply_to_message_id,
      buttons: args.buttons,
      list: args.list,
      idempotencyKey: args.idempotency_key,
      maxAttempts: args.max_attempts,
      testMode: args.test_mode,
    };
  }
  return {
    ...(args as SendMessageArgs & QueueOptions),
    body: args.body ?? "",
  };
}

function normalizeOutboundCallArgs(
  args: CreateOutboundCallArgs | LegacyOutboundCallArgs,
): CreateOutboundCallArgs & QueueOptions {
  if ("to_number" in args) {
    return {
      agentId: args.agent_id,
      toNumber: args.to_number,
      fromNumberId: args.from_number_id,
      initialGreeting: args.initial_greeting,
      voice: args.voice,
      systemPrompt: args.system_prompt,
      modelTier: args.model_tier,
      variables: args.variables,
      callScreeningIdentity: args.call_screening_identity,
      callScreeningPurpose: args.call_screening_purpose,
      idempotencyKey: args.idempotency_key,
      maxAttempts: args.max_attempts,
      testMode: args.test_mode,
    };
  }
  return args;
}

function normalizeWebCallArgs(
  args: CreateWebCallArgs | LegacyWebCallArgs,
): CreateWebCallArgs & QueueOptions {
  if ("agent_id" in args || "idempotency_key" in args) {
    return {
      agentId: args.agent_id,
      metadata: args.metadata,
      variables: args.variables,
      idempotencyKey: args.idempotency_key,
      maxAttempts: args.max_attempts,
      testMode: args.test_mode,
    };
  }
  return args;
}

function normalizeWebhookArgs(
  args: ConfigureWebhookArgs | LegacyWebhookArgs,
): ConfigureWebhookArgs {
  if ("context_limit" in args || "timeout_ms" in args) {
    return {
      url: args.url,
      contextLimit: args.context_limit,
      timeout:
        args.timeout_ms === undefined ? undefined : args.timeout_ms / 1000,
      subAccountId: args.sub_account_id,
    };
  }
  return args;
}

function isDeliveryStatus(value: string): value is DeliveryStatus {
  return [
    "received",
    "dispatching",
    "dispatched",
    "retrying",
    "failed",
    "dead_letter",
    "ignored",
  ].includes(value);
}

/**
 * The scope a derived scope was built from, or null when it is already a base
 * scope. Derived segments are appended by `forSubAccount` (`:sub:<id>`) and
 * `configureAgentWebhook` (`:agent:<id>`), outermost last.
 */
function parentScope(scope: string): string | null {
  for (const marker of [":agent:", ":sub:"]) {
    const index = scope.lastIndexOf(marker);
    if (index > 0 && scope.length > index + marker.length) {
      return scope.slice(0, index);
    }
  }
  return null;
}

function normalizePrefix(value: string) {
  const withLeadingSlash = value.startsWith("/") ? value : `/${value}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function readEventType(rawBody: string) {
  try {
    const value = JSON.parse(rawBody) as unknown;
    return isRecord(value) && typeof value.event === "string"
      ? value.event
      : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonResponse(
  value: unknown,
  status: number,
  additionalHeaders: Record<string, string> = {},
) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...additionalHeaders,
    },
  });
}
