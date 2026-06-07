import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";

import { callAgentPhoneSdk } from "./lib/sdk.js";
import { agentIdArg, json, paginationArgs, stripUndefined } from "./lib/validators.js";

const agentWriteArgs = {
  name: v.optional(v.string()),
  instructions: v.optional(v.string()),
  voice: v.optional(v.string()),
  voice_id: v.optional(v.string()),
  language: v.optional(v.string()),
  greeting: v.optional(v.string()),
  sms_enabled: v.optional(v.boolean()),
  metadata: v.optional(json),
};

export const list = action({
  args: paginationArgs,
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "agents",
      "listAgents",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.resources.upsertAgentsFromResponse, {
      response,
    });
    return response;
  },
});

export const create = action({
  args: agentWriteArgs,
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "agents",
      "createAgent",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.resources.upsertAgentsFromResponse, {
      response,
    });
    return response;
  },
});

export const get = action({
  args: agentIdArg,
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk("agents", "getAgent", {
      agent_id: args.agent_id,
    });
    await ctx.runMutation(internal.resources.upsertAgentsFromResponse, {
      response,
    });
    return response;
  },
});

export const update = action({
  args: {
    ...agentIdArg,
    ...agentWriteArgs,
  },
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "agents",
      "updateAgent",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.resources.upsertAgentsFromResponse, {
      response,
    });
    return response;
  },
});

export const remove = action({
  args: agentIdArg,
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("agents", "deleteAgent", { agent_id: args.agent_id }),
});

export const attachNumber = action({
  args: {
    ...agentIdArg,
    number_id: v.string(),
  },
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk("agents", "attachNumberToAgent", args);
    await ctx.runMutation(internal.resources.upsertAgentsFromResponse, {
      response,
    });
    return response;
  },
});

export const detachNumber = action({
  args: {
    ...agentIdArg,
    number_id: v.string(),
  },
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "agents",
      "detachNumberFromAgent",
      args,
    );
    await ctx.runMutation(internal.resources.upsertAgentsFromResponse, {
      response,
    });
    return response;
  },
});

export const listVoices = action({
  args: {},
  returns: json,
  handler: async () => callAgentPhoneSdk("agents", "listVoices"),
});

export const listConversations = action({
  args: {
    ...agentIdArg,
    ...paginationArgs,
  },
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "agents",
      "listAgentConversations",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.resources.upsertConversationsFromResponse, {
      response,
    });
    return response;
  },
});

export const listCalls = action({
  args: {
    ...agentIdArg,
    ...paginationArgs,
  },
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "agents",
      "listAgentCalls",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.resources.upsertCallsFromResponse, {
      response,
    });
    return response;
  },
});
