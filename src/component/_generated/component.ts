/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    calls: {
      createOutbound: FunctionReference<
        "action",
        "internal",
        {
          agentId: string;
          baseUrl?: string;
          callScreeningIdentity?: string;
          callScreeningPurpose?: string;
          fromNumberId?: string;
          initialGreeting?: string;
          modelTier?: "turbo" | "balanced" | "max";
          scope: string;
          subAccountId?: string;
          systemPrompt?: string;
          testMode?: boolean;
          toNumber: string;
          token: string;
          variables?: Record<string, string>;
          voice?: string;
        },
        any,
        Name
      >;
      createWeb: FunctionReference<
        "action",
        "internal",
        {
          agentId: string;
          baseUrl?: string;
          metadata?: any;
          scope: string;
          subAccountId?: string;
          testMode?: boolean;
          token: string;
          variables?: Record<string, string>;
        },
        any,
        Name
      >;
      end: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          callId: string;
          scope: string;
          subAccountId?: string;
          token: string;
        },
        any,
        Name
      >;
      getRecording: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          callId: string;
          scope: string;
          subAccountId?: string;
          token: string;
        },
        any,
        Name
      >;
      getTranscript: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          callId: string;
          scope: string;
          subAccountId?: string;
          token: string;
        },
        any,
        Name
      >;
    };
    deliveries: {
      cleanup: FunctionReference<
        "mutation",
        "internal",
        {
          limit?: number;
          olderThan: number;
          scope: string;
          statuses?: Array<
            | "received"
            | "dispatching"
            | "dispatched"
            | "retrying"
            | "failed"
            | "dead_letter"
            | "ignored"
          >;
        },
        number,
        Name
      >;
      list: FunctionReference<
        "query",
        "internal",
        {
          agentId?: string;
          limit?: number;
          scope: string;
          status?:
            | "received"
            | "dispatching"
            | "dispatched"
            | "retrying"
            | "failed"
            | "dead_letter"
            | "ignored";
        },
        Array<{
          agentId?: string;
          attempts: number;
          callback?: string;
          channel?: string;
          deliveryId: string;
          error?: string;
          eventId: string;
          eventType: string;
          lastAttemptAt?: number;
          maxAttempts: number;
          nextAttemptAt?: number;
          processedAt?: number;
          receivedAt: number;
          scope: string;
          status:
            | "received"
            | "dispatching"
            | "dispatched"
            | "retrying"
            | "failed"
            | "dead_letter"
            | "ignored";
        }>,
        Name
      >;
      listFailed: FunctionReference<
        "query",
        "internal",
        { limit?: number; scope: string },
        Array<{
          agentId?: string;
          attempts: number;
          callback?: string;
          channel?: string;
          deliveryId: string;
          error?: string;
          eventId: string;
          eventType: string;
          lastAttemptAt?: number;
          maxAttempts: number;
          nextAttemptAt?: number;
          processedAt?: number;
          receivedAt: number;
          scope: string;
          status:
            | "received"
            | "dispatching"
            | "dispatched"
            | "retrying"
            | "failed"
            | "dead_letter"
            | "ignored";
        }>,
        Name
      >;
      replay: FunctionReference<
        "action",
        "internal",
        { deliveryId: string; scope: string },
        boolean,
        Name
      >;
    };
    events: {
      getByDeliveryId: FunctionReference<
        "query",
        "internal",
        { deliveryId: string; scope: string },
        {
          agentId?: string;
          callId?: string;
          channel?: string;
          conversationId?: string;
          deliveryId?: string;
          direction?: string;
          eventType: string;
          messageId?: string;
          numberId?: string;
          payload: any;
          receivedAt: number;
          scope: string;
          source: "webhook" | "api";
          timestamp: string;
        } | null,
        Name
      >;
      list: FunctionReference<
        "query",
        "internal",
        { limit?: number; scope: string },
        Array<{
          agentId?: string;
          callId?: string;
          channel?: string;
          conversationId?: string;
          deliveryId?: string;
          direction?: string;
          eventType: string;
          messageId?: string;
          numberId?: string;
          payload: any;
          receivedAt: number;
          scope: string;
          source: "webhook" | "api";
          timestamp: string;
        }>,
        Name
      >;
      listByAgent: FunctionReference<
        "query",
        "internal",
        { agentId: string; limit?: number; scope: string },
        Array<{
          agentId?: string;
          callId?: string;
          channel?: string;
          conversationId?: string;
          deliveryId?: string;
          direction?: string;
          eventType: string;
          messageId?: string;
          numberId?: string;
          payload: any;
          receivedAt: number;
          scope: string;
          source: "webhook" | "api";
          timestamp: string;
        }>,
        Name
      >;
      listByCall: FunctionReference<
        "query",
        "internal",
        { callId: string; limit?: number; scope: string },
        Array<{
          agentId?: string;
          callId?: string;
          channel?: string;
          conversationId?: string;
          deliveryId?: string;
          direction?: string;
          eventType: string;
          messageId?: string;
          numberId?: string;
          payload: any;
          receivedAt: number;
          scope: string;
          source: "webhook" | "api";
          timestamp: string;
        }>,
        Name
      >;
      listByConversation: FunctionReference<
        "query",
        "internal",
        { conversationId: string; limit?: number; scope: string },
        Array<{
          agentId?: string;
          callId?: string;
          channel?: string;
          conversationId?: string;
          deliveryId?: string;
          direction?: string;
          eventType: string;
          messageId?: string;
          numberId?: string;
          payload: any;
          receivedAt: number;
          scope: string;
          source: "webhook" | "api";
          timestamp: string;
        }>,
        Name
      >;
      listByNumber: FunctionReference<
        "query",
        "internal",
        { limit?: number; numberId: string; scope: string },
        Array<{
          agentId?: string;
          callId?: string;
          channel?: string;
          conversationId?: string;
          deliveryId?: string;
          direction?: string;
          eventType: string;
          messageId?: string;
          numberId?: string;
          payload: any;
          receivedAt: number;
          scope: string;
          source: "webhook" | "api";
          timestamp: string;
        }>,
        Name
      >;
      listBySource: FunctionReference<
        "query",
        "internal",
        { limit?: number; scope: string; source: "webhook" | "api" },
        Array<{
          agentId?: string;
          callId?: string;
          channel?: string;
          conversationId?: string;
          deliveryId?: string;
          direction?: string;
          eventType: string;
          messageId?: string;
          numberId?: string;
          payload: any;
          receivedAt: number;
          scope: string;
          source: "webhook" | "api";
          timestamp: string;
        }>,
        Name
      >;
      listByType: FunctionReference<
        "query",
        "internal",
        { eventType: string; limit?: number; scope: string },
        Array<{
          agentId?: string;
          callId?: string;
          channel?: string;
          conversationId?: string;
          deliveryId?: string;
          direction?: string;
          eventType: string;
          messageId?: string;
          numberId?: string;
          payload: any;
          receivedAt: number;
          scope: string;
          source: "webhook" | "api";
          timestamp: string;
        }>,
        Name
      >;
    };
    messages: {
      send: FunctionReference<
        "action",
        "internal",
        {
          agentId?: string;
          baseUrl?: string;
          body: string;
          buttons?: Array<string>;
          channel?: "whatsapp";
          fromNumber?: string;
          list?: any;
          mediaUrls?: Array<string>;
          numberId?: string;
          recipients?: Array<string>;
          replyToMessageId?: string;
          scope: string;
          sendStyle?:
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
          subAccountId?: string;
          testMode?: boolean;
          toNumber?: string;
          token: string;
        },
        any,
        Name
      >;
    };
    outbound: {
      cancel: FunctionReference<
        "mutation",
        "internal",
        { requestId: string; scope: string },
        boolean,
        Name
      >;
      enqueueMessage: FunctionReference<
        "mutation",
        "internal",
        {
          agentId?: string;
          baseUrl?: string;
          body: string;
          buttons?: Array<string>;
          channel?: "whatsapp";
          fromNumber?: string;
          idempotencyKey?: string;
          list?: any;
          maxAttempts?: number;
          mediaUrls?: Array<string>;
          numberId?: string;
          recipients?: Array<string>;
          replyToMessageId?: string;
          scope: string;
          sendStyle?: string;
          subAccountId?: string;
          testMode?: boolean;
          toNumber?: string;
        },
        {
          requestId: string;
          status: "queued" | "sending" | "sent" | "failed" | "cancelled";
        },
        Name
      >;
      enqueueOutboundCall: FunctionReference<
        "mutation",
        "internal",
        {
          agentId: string;
          baseUrl?: string;
          callScreeningIdentity?: string;
          callScreeningPurpose?: string;
          fromNumberId?: string;
          idempotencyKey?: string;
          initialGreeting?: string;
          maxAttempts?: number;
          modelTier?: string;
          scope: string;
          subAccountId?: string;
          systemPrompt?: string;
          testMode?: boolean;
          toNumber: string;
          variables?: Record<string, string>;
          voice?: string;
        },
        {
          requestId: string;
          status: "queued" | "sending" | "sent" | "failed" | "cancelled";
        },
        Name
      >;
      enqueueWebCall: FunctionReference<
        "mutation",
        "internal",
        {
          agentId: string;
          baseUrl?: string;
          idempotencyKey?: string;
          maxAttempts?: number;
          metadata?: any;
          scope: string;
          subAccountId?: string;
          testMode?: boolean;
          variables?: Record<string, string>;
        },
        {
          requestId: string;
          status: "queued" | "sending" | "sent" | "failed" | "cancelled";
        },
        Name
      >;
      getStatus: FunctionReference<
        "query",
        "internal",
        { requestId: string; scope: string },
        {
          agentId?: string;
          args: any;
          attempts: number;
          callId?: string;
          conversationId?: string;
          createdAt: number;
          error?: string;
          idempotencyKey?: string;
          kind: "message" | "outbound_call" | "web_call";
          maxAttempts: number;
          messageId?: string;
          nextAttemptAt?: number;
          numberId?: string;
          result?: any;
          scope: string;
          status: "queued" | "sending" | "sent" | "failed" | "cancelled";
          updatedAt: number;
        } | null,
        Name
      >;
      listRequests: FunctionReference<
        "query",
        "internal",
        {
          agentId?: string;
          limit?: number;
          scope: string;
          status?: "queued" | "sending" | "sent" | "failed" | "cancelled";
        },
        Array<{
          agentId?: string;
          args: any;
          attempts: number;
          callId?: string;
          conversationId?: string;
          createdAt: number;
          error?: string;
          idempotencyKey?: string;
          kind: "message" | "outbound_call" | "web_call";
          maxAttempts: number;
          messageId?: string;
          nextAttemptAt?: number;
          numberId?: string;
          result?: any;
          scope: string;
          status: "queued" | "sending" | "sent" | "failed" | "cancelled";
          updatedAt: number;
        }>,
        Name
      >;
    };
    request: {
      request: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          body?: any;
          method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
          path: string;
          query?: Record<string, string | number | boolean | null>;
          subAccountId?: string;
          token: string;
        },
        any,
        Name
      >;
    };
    resources: {
      getAgent: FunctionReference<
        "query",
        "internal",
        { agentId: string; scope: string },
        {
          agentId: string;
          name?: string;
          payload: any;
          scope: string;
          status?: string;
          syncedAt: number;
          updatedAt: number;
        } | null,
        Name
      >;
      getCallRecording: FunctionReference<
        "query",
        "internal",
        { callId: string; scope: string },
        {
          callId: string;
          payload: any;
          scope: string;
          syncedAt: number;
          updatedAt: number;
          url?: string;
        } | null,
        Name
      >;
      getCallTranscript: FunctionReference<
        "query",
        "internal",
        { callId: string; scope: string },
        {
          callId: string;
          payload: any;
          scope: string;
          syncedAt: number;
          updatedAt: number;
        } | null,
        Name
      >;
      getConversation: FunctionReference<
        "query",
        "internal",
        { conversationId: string; scope: string },
        {
          agentId?: string;
          conversationId: string;
          counterparty?: string;
          lastActivityAt?: number;
          lastDirection?: string;
          lastMessageId?: string;
          lastMessageText?: string;
          numberId?: string;
          payload: any;
          scope: string;
          status?: string;
          syncedAt: number;
          updatedAt: number;
        } | null,
        Name
      >;
      getLatestConversationState: FunctionReference<
        "query",
        "internal",
        { conversationId: string; messageLimit?: number; scope: string },
        {
          conversation: {
            agentId?: string;
            conversationId: string;
            counterparty?: string;
            lastActivityAt?: number;
            lastDirection?: string;
            lastMessageId?: string;
            lastMessageText?: string;
            numberId?: string;
            payload: any;
            scope: string;
            status?: string;
            syncedAt: number;
            updatedAt: number;
          };
          messages: Array<{
            agentId?: string;
            body?: string;
            callId?: string;
            channel?: string;
            conversationId?: string;
            counterparty?: string;
            direction?: string;
            from?: string;
            messageId: string;
            numberId?: string;
            payload: any;
            scope: string;
            status?: string;
            syncedAt: number;
            timestamp?: number;
            to?: string;
            updatedAt: number;
          }>;
        } | null,
        Name
      >;
      getNumber: FunctionReference<
        "query",
        "internal",
        { numberId: string; scope: string },
        {
          agentId?: string;
          numberId: string;
          payload: any;
          phoneNumber?: string;
          scope: string;
          status?: string;
          syncedAt: number;
          updatedAt: number;
        } | null,
        Name
      >;
      listAgents: FunctionReference<
        "query",
        "internal",
        { limit?: number; scope: string },
        Array<{
          agentId: string;
          name?: string;
          payload: any;
          scope: string;
          status?: string;
          syncedAt: number;
          updatedAt: number;
        }>,
        Name
      >;
      listCallsByAgent: FunctionReference<
        "query",
        "internal",
        { agentId: string; limit?: number; scope: string },
        Array<{
          agentId?: string;
          callId: string;
          conversationId?: string;
          direction?: string;
          durationSeconds?: number;
          endedAt?: number;
          from?: string;
          numberId?: string;
          payload: any;
          scope: string;
          startedAt?: number;
          status?: string;
          syncedAt: number;
          to?: string;
          updatedAt: number;
        }>,
        Name
      >;
      listCallsByNumber: FunctionReference<
        "query",
        "internal",
        { limit?: number; numberId: string; scope: string },
        Array<{
          agentId?: string;
          callId: string;
          conversationId?: string;
          direction?: string;
          durationSeconds?: number;
          endedAt?: number;
          from?: string;
          numberId?: string;
          payload: any;
          scope: string;
          startedAt?: number;
          status?: string;
          syncedAt: number;
          to?: string;
          updatedAt: number;
        }>,
        Name
      >;
      listConversations: FunctionReference<
        "query",
        "internal",
        {
          agentId?: string;
          counterparty?: string;
          limit?: number;
          numberId?: string;
          scope: string;
        },
        Array<{
          agentId?: string;
          conversationId: string;
          counterparty?: string;
          lastActivityAt?: number;
          lastDirection?: string;
          lastMessageId?: string;
          lastMessageText?: string;
          numberId?: string;
          payload: any;
          scope: string;
          status?: string;
          syncedAt: number;
          updatedAt: number;
        }>,
        Name
      >;
      listMessagesByAgent: FunctionReference<
        "query",
        "internal",
        { agentId: string; limit?: number; scope: string },
        Array<{
          agentId?: string;
          body?: string;
          callId?: string;
          channel?: string;
          conversationId?: string;
          counterparty?: string;
          direction?: string;
          from?: string;
          messageId: string;
          numberId?: string;
          payload: any;
          scope: string;
          status?: string;
          syncedAt: number;
          timestamp?: number;
          to?: string;
          updatedAt: number;
        }>,
        Name
      >;
      listMessagesByConversation: FunctionReference<
        "query",
        "internal",
        { conversationId: string; limit?: number; scope: string },
        Array<{
          agentId?: string;
          body?: string;
          callId?: string;
          channel?: string;
          conversationId?: string;
          counterparty?: string;
          direction?: string;
          from?: string;
          messageId: string;
          numberId?: string;
          payload: any;
          scope: string;
          status?: string;
          syncedAt: number;
          timestamp?: number;
          to?: string;
          updatedAt: number;
        }>,
        Name
      >;
      listMessagesByCounterparty: FunctionReference<
        "query",
        "internal",
        { counterparty: string; limit?: number; scope: string },
        Array<{
          agentId?: string;
          body?: string;
          callId?: string;
          channel?: string;
          conversationId?: string;
          counterparty?: string;
          direction?: string;
          from?: string;
          messageId: string;
          numberId?: string;
          payload: any;
          scope: string;
          status?: string;
          syncedAt: number;
          timestamp?: number;
          to?: string;
          updatedAt: number;
        }>,
        Name
      >;
      listMessagesByNumber: FunctionReference<
        "query",
        "internal",
        { limit?: number; numberId: string; scope: string },
        Array<{
          agentId?: string;
          body?: string;
          callId?: string;
          channel?: string;
          conversationId?: string;
          counterparty?: string;
          direction?: string;
          from?: string;
          messageId: string;
          numberId?: string;
          payload: any;
          scope: string;
          status?: string;
          syncedAt: number;
          timestamp?: number;
          to?: string;
          updatedAt: number;
        }>,
        Name
      >;
      listNumbers: FunctionReference<
        "query",
        "internal",
        { limit?: number; scope: string },
        Array<{
          agentId?: string;
          numberId: string;
          payload: any;
          phoneNumber?: string;
          scope: string;
          status?: string;
          syncedAt: number;
          updatedAt: number;
        }>,
        Name
      >;
    };
    subAccounts: {
      adopt: FunctionReference<
        "mutation",
        "internal",
        { key?: string; name?: string; scope: string; subAccountId: string },
        {
          key?: string;
          name?: string;
          payload: any;
          scope: string;
          status: "active";
          subAccountId: string;
          syncedAt: number;
          updatedAt: number;
        },
        Name
      >;
      create: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          key?: string;
          name: string;
          scope: string;
          token: string;
        },
        {
          key?: string;
          name?: string;
          payload: any;
          scope: string;
          status: "active";
          subAccountId: string;
          syncedAt: number;
          updatedAt: number;
        },
        Name
      >;
      get: FunctionReference<
        "query",
        "internal",
        { key?: string; scope: string; subAccountId?: string },
        {
          key?: string;
          name?: string;
          payload: any;
          scope: string;
          status: "provisioning" | "active";
          subAccountId?: string;
          syncedAt: number;
          updatedAt: number;
        } | null,
        Name
      >;
      list: FunctionReference<
        "query",
        "internal",
        { limit?: number; scope: string },
        Array<{
          key?: string;
          name?: string;
          payload: any;
          scope: string;
          status: "provisioning" | "active";
          subAccountId?: string;
          syncedAt: number;
          updatedAt: number;
        }>,
        Name
      >;
      releaseClaimByKey: FunctionReference<
        "mutation",
        "internal",
        { key: string; scope: string },
        boolean,
        Name
      >;
      remove: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          scope: string;
          subAccountId: string;
          token: string;
        },
        null,
        Name
      >;
      update: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          name: string;
          scope: string;
          subAccountId: string;
          token: string;
        },
        {
          key?: string;
          name?: string;
          payload: any;
          scope: string;
          status: "active";
          subAccountId: string;
          syncedAt: number;
          updatedAt: number;
        },
        Name
      >;
    };
    sync: {
      agents: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          limit?: number;
          offset?: number;
          scope: string;
          subAccountId?: string;
          token: string;
        },
        { response: any; synced: number },
        Name
      >;
      calls: FunctionReference<
        "action",
        "internal",
        {
          agentId?: string;
          baseUrl?: string;
          direction?: string;
          limit?: number;
          numberId?: string;
          offset?: number;
          scope: string;
          search?: string;
          status?: string;
          subAccountId?: string;
          token: string;
        },
        { response: any; synced: number },
        Name
      >;
      conversations: FunctionReference<
        "action",
        "internal",
        {
          agentId?: string;
          baseUrl?: string;
          limit?: number;
          numberId?: string;
          offset?: number;
          scope: string;
          subAccountId?: string;
          token: string;
        },
        { response: any; synced: number },
        Name
      >;
      messages: FunctionReference<
        "action",
        "internal",
        {
          after?: string;
          baseUrl?: string;
          before?: string;
          conversationId?: string;
          limit?: number;
          numberId?: string;
          scope: string;
          subAccountId?: string;
          token: string;
        },
        { response: any; synced: number },
        Name
      >;
      numbers: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          limit?: number;
          offset?: number;
          scope: string;
          subAccountId?: string;
          token: string;
        },
        { response: any; synced: number },
        Name
      >;
      subAccounts: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          limit?: number;
          offset?: number;
          scope: string;
          token: string;
        },
        { response: any; synced: number },
        Name
      >;
    };
    webhooks: {
      configure: FunctionReference<
        "action",
        "internal",
        {
          agentId?: string;
          baseUrl?: string;
          contextLimit?: number;
          scope: string;
          subAccountId?: string;
          timeout?: number;
          token: string;
          url: string;
        },
        {
          contextLimit: number;
          createdAt: string;
          id: string;
          secret: string;
          status: string;
          timeout: number;
          url: string;
        },
        Name
      >;
      handle: FunctionReference<
        "action",
        "internal",
        {
          callback?: string;
          deliveryId: string;
          rawBody: string;
          scope: string;
          secretOverride?: string;
          signature: string;
          timestamp: string;
          toleranceSeconds?: number;
        },
        | { callbackResult: any; duplicate: boolean; kind: "success" }
        | { kind: "error"; message: string; status: number },
        Name
      >;
      remove: FunctionReference<
        "action",
        "internal",
        {
          agentId?: string;
          baseUrl?: string;
          scope: string;
          subAccountId?: string;
          token: string;
        },
        null,
        Name
      >;
      setSecret: FunctionReference<
        "mutation",
        "internal",
        {
          agentId?: string;
          scope: string;
          secret: string;
          subAccountId?: string;
        },
        null,
        Name
      >;
    };
  };
