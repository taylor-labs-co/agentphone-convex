import { action } from "./_generated/server.js";
import { v } from "convex/values";

import { callAgentPhoneSdk } from "./lib/sdk.js";
import { json, stripUndefined } from "./lib/validators.js";

export const send = action({
  args: {
    agent_id: v.string(),
    to_number: v.string(),
    body: v.optional(v.string()),
    media_urls: v.optional(v.array(v.string())),
    channel: v.optional(v.union(v.literal("sms"), v.literal("imessage"))),
    metadata: v.optional(json),
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("messages", "sendMessage", stripUndefined(args)),
});

export const sendReaction = action({
  args: {
    message_id: v.string(),
    reaction: v.string(),
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("messages", "sendReaction", args),
});
