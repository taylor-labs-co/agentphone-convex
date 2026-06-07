import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";

import { callAgentPhoneSdk } from "./lib/sdk.js";
import { extractWebhookSecret } from "./lib/webhookPayload.js";
import { json, paginationArgs, stripUndefined } from "./lib/validators.js";

const syncResult = v.object({
  synced: v.number(),
  response: v.optional(json),
  skipped: v.optional(v.string()),
});

export const syncAgents = action({
  args: paginationArgs,
  returns: syncResult,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "agents",
      "listAgents",
      stripUndefined(args),
    );
    const synced = await ctx.runMutation(
      internal.resources.upsertAgentsFromResponse,
      { response },
    );
    return { synced, response };
  },
});

export const syncNumbers = action({
  args: paginationArgs,
  returns: syncResult,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "numbers",
      "listNumbers",
      stripUndefined(args),
    );
    const synced = await ctx.runMutation(
      internal.resources.upsertNumbersFromResponse,
      { response },
    );
    return { synced, response };
  },
});

export const syncRecentConversations = action({
  args: {
    ...paginationArgs,
    agent_id: v.optional(v.string()),
    number_id: v.optional(v.string()),
  },
  returns: syncResult,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "conversations",
      "listConversations",
      stripUndefined(args),
    );
    const synced = await ctx.runMutation(
      internal.resources.upsertConversationsFromResponse,
      { response },
    );
    return { synced, response };
  },
});

export const syncRecentMessages = action({
  args: {
    ...paginationArgs,
    conversation_id: v.optional(v.string()),
    number_id: v.optional(v.string()),
  },
  returns: syncResult,
  handler: async (ctx, args) => {
    if (!args.conversation_id && !args.number_id) {
      return {
        synced: 0,
        skipped:
          "syncRecentMessages requires either conversation_id or number_id.",
      };
    }
    const response = args.conversation_id
      ? await callAgentPhoneSdk(
          "conversations",
          "getConversationMessages",
          stripUndefined(args),
        )
      : await callAgentPhoneSdk("numbers", "getMessages", stripUndefined(args));
    const synced = await ctx.runMutation(
      internal.resources.upsertMessagesFromResponse,
      { response },
    );
    return { synced, response };
  },
});

export const syncRecentCalls = action({
  args: {
    ...paginationArgs,
    agent_id: v.optional(v.string()),
    number_id: v.optional(v.string()),
  },
  returns: syncResult,
  handler: async (ctx, args) => {
    const response = args.number_id
      ? await callAgentPhoneSdk(
          "calls",
          "listCallsForNumber",
          stripUndefined(args),
        )
      : await callAgentPhoneSdk("calls", "listCalls", stripUndefined(args));
    const synced = await ctx.runMutation(
      internal.resources.upsertCallsFromResponse,
      { response },
    );
    return { synced, response };
  },
});

export const reconcileWebhookConfig = action({
  args: {
    agent_id: v.optional(v.string()),
  },
  returns: syncResult,
  handler: async (ctx, args) => {
    const response = args.agent_id
      ? await callAgentPhoneSdk("agentWebhooks", "getAgentWebhook", args)
      : await callAgentPhoneSdk("webhooks", "getWebhook");
    await ctx.runMutation(internal.state.upsertWebhookConfig, {
      scope: args.agent_id ? "agent" : "project",
      agentId: args.agent_id,
      url: urlFromResponse(response) ?? "",
      secret: extractWebhookSecret(response),
      status: statusFromResponse(response),
      providerResponse: response,
    });
    return { synced: 1, response };
  },
});

function urlFromResponse(response: unknown) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return undefined;
  }
  const value = (response as Record<string, unknown>).url;
  return typeof value === "string" ? value : undefined;
}

function statusFromResponse(response: unknown) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return undefined;
  }
  const value = (response as Record<string, unknown>).status;
  return typeof value === "string" ? value : undefined;
}
