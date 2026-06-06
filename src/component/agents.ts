import { action } from "./_generated/server.js";
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
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("agents", "listAgents", stripUndefined(args)),
});

export const create = action({
  args: agentWriteArgs,
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("agents", "createAgent", stripUndefined(args)),
});

export const get = action({
  args: agentIdArg,
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("agents", "getAgent", { agent_id: args.agent_id }),
});

export const update = action({
  args: {
    ...agentIdArg,
    ...agentWriteArgs,
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("agents", "updateAgent", stripUndefined(args)),
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
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("agents", "attachNumberToAgent", args),
});

export const detachNumber = action({
  args: {
    ...agentIdArg,
    number_id: v.string(),
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("agents", "detachNumberFromAgent", args),
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
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("agents", "listAgentConversations", stripUndefined(args)),
});

export const listCalls = action({
  args: {
    ...agentIdArg,
    ...paginationArgs,
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("agents", "listAgentCalls", stripUndefined(args)),
});
