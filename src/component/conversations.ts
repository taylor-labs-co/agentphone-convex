import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";

import { callAgentPhoneSdk } from "./lib/sdk.js";
import {
  conversationIdArg,
  json,
  paginationArgs,
  stripUndefined,
} from "./lib/validators.js";

export const list = action({
  args: {
    ...paginationArgs,
    agent_id: v.optional(v.string()),
    number_id: v.optional(v.string()),
  },
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "conversations",
      "listConversations",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.resources.upsertConversationsFromResponse, {
      response,
    });
    return response;
  },
});

export const get = action({
  args: conversationIdArg,
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "conversations",
      "getConversation",
      args,
    );
    await ctx.runMutation(internal.resources.upsertConversationsFromResponse, {
      response,
    });
    return response;
  },
});

export const update = action({
  args: {
    ...conversationIdArg,
    metadata: v.optional(json),
    archived: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
  },
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "conversations",
      "updateConversation",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.resources.upsertConversationsFromResponse, {
      response,
    });
    return response;
  },
});

export const listMessages = action({
  args: {
    ...conversationIdArg,
    ...paginationArgs,
  },
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "conversations",
      "getConversationMessages",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.resources.upsertMessagesFromResponse, {
      response,
    });
    return response;
  },
});

export const sendTypingIndicator = action({
  args: {
    ...conversationIdArg,
    typing: v.optional(v.boolean()),
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk(
      "conversations",
      "sendTypingIndicator",
      stripUndefined(args),
    ),
});
