import { action } from "./_generated/server.js";
import { v } from "convex/values";

import { callAgentPhoneSdk } from "./lib/sdk.js";
import { dateRangeArgs, json, stripUndefined } from "./lib/validators.js";

export const get = action({
  args: {},
  returns: json,
  handler: async () => callAgentPhoneSdk("usage", "getUsage"),
});

export const daily = action({
  args: {
    days: v.optional(v.number()),
    ...dateRangeArgs,
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("usage", "getDailyUsage", stripUndefined(args)),
});

export const monthly = action({
  args: {
    months: v.optional(v.number()),
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("usage", "getMonthlyUsage", stripUndefined(args)),
});

export const byNumber = action({
  args: {},
  returns: json,
  handler: async () => callAgentPhoneSdk("usage", "getUsageByNumber"),
});

export const byAgent = action({
  args: {
    period: v.union(v.literal("week"), v.literal("month"), v.literal("year")),
  },
  returns: json,
  handler: async (_ctx, args) => callAgentPhoneSdk("usage", "getUsageByAgent", args),
});
