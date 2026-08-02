import { v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { agentPhoneRequest } from "./request.js";

const modelTierValidator = v.union(
  v.literal("turbo"),
  v.literal("balanced"),
  v.literal("max"),
);

const sharedArgs = {
  token: v.string(),
  scope: v.string(),
  subAccountId: v.optional(v.string()),
  baseUrl: v.optional(v.string()),
};

export const createOutbound = action({
  args: {
    ...sharedArgs,
    agentId: v.string(),
    toNumber: v.string(),
    fromNumberId: v.optional(v.string()),
    initialGreeting: v.optional(v.string()),
    voice: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    modelTier: v.optional(modelTierValidator),
    variables: v.optional(v.record(v.string(), v.string())),
    callScreeningIdentity: v.optional(v.string()),
    callScreeningPurpose: v.optional(v.string()),
    testMode: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const body = {
      agentId: args.agentId,
      toNumber: args.toNumber,
      ...(args.fromNumberId && { fromNumberId: args.fromNumberId }),
      ...(args.initialGreeting && { initialGreeting: args.initialGreeting }),
      ...(args.voice && { voice: args.voice }),
      ...(args.systemPrompt && { systemPrompt: args.systemPrompt }),
      ...(args.modelTier && { modelTier: args.modelTier }),
      ...(args.variables && { variables: args.variables }),
      ...(args.callScreeningIdentity && {
        callScreeningIdentity: args.callScreeningIdentity,
      }),
      ...(args.callScreeningPurpose && {
        callScreeningPurpose: args.callScreeningPurpose,
      }),
    };
    const response = args.testMode
      ? {
          testMode: true,
          status: "skipped",
          kind: "outbound_call",
          args: body,
        }
      : await agentPhoneRequest({
          token: args.token,
          method: "POST",
          path: "calls",
          subAccountId: args.subAccountId,
          baseUrl: args.baseUrl,
          body,
        });
    await recordCallBestEffort(
      ctx,
      args.scope,
      "call.created",
      args.agentId,
      response,
    );
    return response;
  },
});

export const createWeb = action({
  args: {
    ...sharedArgs,
    agentId: v.string(),
    metadata: v.optional(v.any()),
    variables: v.optional(v.record(v.string(), v.string())),
    testMode: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const body = {
      agentId: args.agentId,
      ...(args.metadata !== undefined && { metadata: args.metadata }),
      ...(args.variables && { variables: args.variables }),
    };
    const response = args.testMode
      ? { testMode: true, status: "skipped", kind: "web_call", args: body }
      : await agentPhoneRequest({
          token: args.token,
          method: "POST",
          path: "calls/web",
          subAccountId: args.subAccountId,
          baseUrl: args.baseUrl,
          body,
        });
    await recordCallBestEffort(
      ctx,
      args.scope,
      "call.web_created",
      args.agentId,
      response,
    );
    return response;
  },
});

export const end = action({
  args: {
    ...sharedArgs,
    callId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const response = await agentPhoneRequest({
      token: args.token,
      method: "POST",
      path: `calls/${encodeURIComponent(args.callId)}/end`,
      subAccountId: args.subAccountId,
      baseUrl: args.baseUrl,
    });
    try {
      await ctx.runMutation(internal.resources.upsertCallsFromResponse, {
        scope: args.scope,
        response,
      });
      await ctx.runMutation(internal.events.recordApiEvent, {
        scope: args.scope,
        eventType: "call.ended",
        callId: args.callId,
        payload: response,
      });
    } catch (error) {
      console.error("AgentPhone call ended but event recording failed", error);
    }
    return response;
  },
});

export const getTranscript = action({
  args: {
    ...sharedArgs,
    callId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const response = await agentPhoneRequest({
      token: args.token,
      method: "GET",
      path: `calls/${encodeURIComponent(args.callId)}/transcript`,
      subAccountId: args.subAccountId,
      baseUrl: args.baseUrl,
    });
    await ctx.runMutation(internal.resources.upsertCallTranscript, {
      scope: args.scope,
      callId: args.callId,
      response,
    });
    return response;
  },
});

export const getRecording = action({
  args: {
    ...sharedArgs,
    callId: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const response = await agentPhoneRequest({
      token: args.token,
      method: "GET",
      path: `calls/${encodeURIComponent(args.callId)}/recording`,
      subAccountId: args.subAccountId,
      baseUrl: args.baseUrl,
    });
    await ctx.runMutation(internal.resources.upsertCallRecording, {
      scope: args.scope,
      callId: args.callId,
      response,
    });
    return response;
  },
});

async function recordCallBestEffort(
  ctx: ActionCtx,
  scope: string,
  eventType: string,
  agentId: string,
  response: unknown,
) {
  const callId = stringField(response, "id") ?? stringField(response, "callId");
  try {
    await ctx.runMutation(internal.resources.upsertCallsFromResponse, {
      scope,
      response,
    });
  } catch (error) {
    console.error("AgentPhone call created but local state sync failed", error);
  }
  try {
    await ctx.runMutation(internal.events.recordApiEvent, {
      scope,
      eventType,
      channel: "voice",
      agentId,
      ...(callId && { callId }),
      direction: "outbound",
      payload: response,
    });
  } catch (error) {
    console.error("AgentPhone call created but event recording failed", error);
  }
}

function stringField(value: unknown, key: string) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : undefined;
}
