import { action } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
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
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "calls",
      "listCalls",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.resources.upsertCallsFromResponse, {
      response,
    });
    return response;
  },
});

export const listForNumber = action({
  args: {
    ...numberIdArg,
    ...paginationArgs,
    ...dateRangeArgs,
  },
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk(
      "calls",
      "listCallsForNumber",
      stripUndefined(args),
    );
    await ctx.runMutation(internal.resources.upsertCallsFromResponse, {
      response,
    });
    return response;
  },
});

export const get = action({
  args: callIdArg,
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk("calls", "getCall", args);
    await ctx.runMutation(internal.resources.upsertCallsFromResponse, {
      response,
    });
    return response;
  },
});

export const createOutbound = action({
  args: {
    agent_id: v.string(),
    to_number: v.string(),
    from_number_id: v.optional(v.string()),
    metadata: v.optional(json),
    test_mode: v.optional(v.boolean()),
  },
  returns: json,
  handler: async (ctx, args) => {
    const request = stripUndefined({ ...args, test_mode: undefined });
    const response = args.test_mode
      ? { testMode: true, status: "skipped", kind: "outboundCall", args: request }
      : await callAgentPhoneSdk("calls", "createOutboundCall", request);
    await ctx.runMutation(internal.resources.upsertCallsFromResponse, {
      response,
    });
    return response;
  },
});

export const createWeb = action({
  args: {
    agent_id: v.string(),
    metadata: v.optional(json),
    test_mode: v.optional(v.boolean()),
  },
  returns: json,
  handler: async (ctx, args) => {
    const request = stripUndefined({ ...args, test_mode: undefined });
    const response = args.test_mode
      ? { testMode: true, status: "skipped", kind: "webCall", args: request }
      : await callAgentPhoneSdk("calls", "createWebCall", request);
    await ctx.runMutation(internal.resources.upsertCallsFromResponse, {
      response,
    });
    return response;
  },
});

export const end = action({
  args: callIdArg,
  returns: json,
  handler: async (_ctx, args) => callAgentPhoneSdk("calls", "endCall", args),
});

export const getRecording = action({
  args: callIdArg,
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk("calls", "getCallRecording", args);
    await ctx.runMutation(internal.resources.upsertCallRecording, {
      callId: args.call_id,
      response,
    });
    return response;
  },
});

export const getTranscript = action({
  args: callIdArg,
  returns: json,
  handler: async (ctx, args) => {
    const response = await callAgentPhoneSdk("calls", "getCallTranscript", args);
    await ctx.runMutation(internal.resources.upsertCallTranscript, {
      callId: args.call_id,
      response,
    });
    return response;
  },
});
