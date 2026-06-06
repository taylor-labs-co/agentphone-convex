import { action } from "./_generated/server.js";
import { v } from "convex/values";

import { callAgentPhoneSdk } from "./lib/sdk.js";
import { json, numberIdArg, paginationArgs, stripUndefined } from "./lib/validators.js";

export const list = action({
  args: paginationArgs,
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("numbers", "listNumbers", stripUndefined(args)),
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
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("numbers", "createNumber", stripUndefined(args)),
});

export const listMessages = action({
  args: {
    ...numberIdArg,
    ...paginationArgs,
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("numbers", "getMessages", stripUndefined(args)),
});

export const release = action({
  args: numberIdArg,
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("numbers", "deleteNumber", { number_id: args.number_id }),
});
