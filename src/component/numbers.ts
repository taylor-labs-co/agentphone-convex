import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { v } from "convex/values";

import { callAgentPhoneSdk } from "./lib/sdk.js";
import { json, numberIdArg, paginationArgs, stripUndefined } from "./lib/validators.js";

export const list = action({
  args: paginationArgs,
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "numbers",
      "listNumbers",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.resources.upsertNumbersFromResponse, {
      response,
    });
    return response;
  },
});

export const create = action({
  args: {
    agent_id: v.optional(v.string()),
    area_code: v.optional(v.string()),
    country: v.optional(v.string()),
    phone_number: v.optional(v.string()),
    sms_provider: v.optional(v.string()),
  },
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "numbers",
      "createNumber",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.resources.upsertNumbersFromResponse, {
      response,
    });
    return response;
  },
});

export const listMessages = action({
  args: {
    ...numberIdArg,
    ...paginationArgs,
  },
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "numbers",
      "getMessages",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.resources.upsertMessagesFromResponse, {
      response,
    });
    return response;
  },
});

export const release = action({
  args: numberIdArg,
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("numbers", "deleteNumber", { number_id: args.number_id }),
});
