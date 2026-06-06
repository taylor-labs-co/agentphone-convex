import { action } from "./_generated/server.js";
import { v } from "convex/values";

import { callAgentPhoneSdk } from "./lib/sdk.js";
import {
  callIdArg,
  dateRangeArgs,
  json,
  numberIdArg,
  paginationArgs,
  stripUndefined,
} from "./lib/validators.js";

export const list = action({
  args: {
    ...paginationArgs,
    ...dateRangeArgs,
    agent_id: v.optional(v.string()),
    number_id: v.optional(v.string()),
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("calls", "listCalls", stripUndefined(args)),
});

export const listForNumber = action({
  args: {
    ...numberIdArg,
    ...paginationArgs,
    ...dateRangeArgs,
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("calls", "listCallsForNumber", stripUndefined(args)),
});

export const get = action({
  args: callIdArg,
  returns: json,
  handler: async (_ctx, args) => callAgentPhoneSdk("calls", "getCall", args),
});

export const createOutbound = action({
  args: {
    agent_id: v.string(),
    to_number: v.string(),
    from_number_id: v.optional(v.string()),
    metadata: v.optional(json),
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("calls", "createOutboundCall", stripUndefined(args)),
});

export const createWeb = action({
  args: {
    agent_id: v.string(),
    metadata: v.optional(json),
  },
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("calls", "createWebCall", stripUndefined(args)),
});

export const end = action({
  args: callIdArg,
  returns: json,
  handler: async (_ctx, args) => callAgentPhoneSdk("calls", "endCall", args),
});

export const getRecording = action({
  args: callIdArg,
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("calls", "getCallRecording", args),
});

export const getTranscript = action({
  args: callIdArg,
  returns: json,
  handler: async (_ctx, args) =>
    callAgentPhoneSdk("calls", "getCallTranscript", args),
});
