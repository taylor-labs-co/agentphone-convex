import type { FunctionHandle } from "convex/server";
import { v, type Infer, type VString } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
} from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import type { Doc } from "./_generated/dataModel.js";
import { agentPhoneRequest } from "./request.js";
import {
  agentPhoneEventValidator,
  voiceWebhookResponseValidator,
  webhookResponseValidator,
} from "./validators.js";

type WebhookEvent = Infer<typeof agentPhoneEventValidator>;
type CallbackResult = Infer<typeof voiceWebhookResponseValidator> | null;
type ConfigArgs = {
  scope: string;
  secret: string;
  webhookId?: string;
  url?: string;
  status?: string;
  contextLimit?: number;
  timeout?: number;
  agentId?: string;
  subAccountId?: string;
  createdAt?: string;
};
type HandleResult =
  | { kind: "success"; duplicate: boolean; callbackResult: CallbackResult }
  | { kind: "error"; status: number; message: string };
type InsertWebhookResult = {
  duplicate: boolean;
  callbackResult: CallbackResult;
};
const eventCallbackValidator = v.string() as VString<
  FunctionHandle<
    "mutation",
    { event: WebhookEvent; scope: string },
    CallbackResult
  >
>;

const configFields = {
  scope: v.string(),
  secret: v.string(),
  webhookId: v.optional(v.string()),
  url: v.optional(v.string()),
  status: v.optional(v.string()),
  contextLimit: v.optional(v.number()),
  timeout: v.optional(v.number()),
  agentId: v.optional(v.string()),
  subAccountId: v.optional(v.string()),
  createdAt: v.optional(v.string()),
};

export const setSecret = mutation({
  args: {
    scope: v.string(),
    secret: v.string(),
    agentId: v.optional(v.string()),
    subAccountId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await upsertConfigDocument(ctx, args);
    return null;
  },
});

export const configure = action({
  args: {
    token: v.string(),
    scope: v.string(),
    url: v.string(),
    contextLimit: v.optional(v.number()),
    timeout: v.optional(v.number()),
    agentId: v.optional(v.string()),
    subAccountId: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
  },
  returns: webhookResponseValidator,
  handler: async (
    ctx,
    args,
  ): Promise<Infer<typeof webhookResponseValidator>> => {
    validateWebhookOptions(args.contextLimit, args.timeout);
    const path = args.agentId
      ? `agents/${encodeURIComponent(args.agentId)}/webhook`
      : "webhooks";
    const rawResponse = await agentPhoneRequest({
      token: args.token,
      method: "POST",
      path,
      subAccountId: args.subAccountId,
      baseUrl: args.baseUrl,
      body: {
        url: args.url,
        ...(args.contextLimit !== undefined && {
          contextLimit: args.contextLimit,
        }),
        ...(args.timeout !== undefined && { timeout: args.timeout }),
      },
    });
    const response = parseWebhookResponse(rawResponse);
    await ctx.runMutation(internal.webhooks.upsertConfig, {
      scope: args.scope,
      secret: response.secret,
      webhookId: response.id,
      url: response.url,
      status: response.status,
      contextLimit: response.contextLimit,
      timeout: response.timeout,
      createdAt: response.createdAt,
      ...(args.agentId && { agentId: args.agentId }),
      ...(args.subAccountId && { subAccountId: args.subAccountId }),
    });
    return response;
  },
});

export const remove = action({
  args: {
    token: v.string(),
    scope: v.string(),
    agentId: v.optional(v.string()),
    subAccountId: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const path = args.agentId
      ? `agents/${encodeURIComponent(args.agentId)}/webhook`
      : "webhooks";
    await agentPhoneRequest({
      token: args.token,
      method: "DELETE",
      path,
      subAccountId: args.subAccountId,
      baseUrl: args.baseUrl,
    });
    await ctx.runMutation(internal.webhooks.deleteConfig, {
      scope: args.scope,
    });
    return null;
  },
});

export const handle = action({
  args: {
    scope: v.string(),
    rawBody: v.string(),
    signature: v.string(),
    timestamp: v.string(),
    deliveryId: v.string(),
    secretOverride: v.optional(v.string()),
    toleranceSeconds: v.optional(v.number()),
    callback: v.optional(eventCallbackValidator),
  },
  returns: v.union(
    v.object({
      kind: v.literal("success"),
      duplicate: v.boolean(),
      callbackResult: v.any(),
    }),
    v.object({
      kind: v.literal("error"),
      status: v.number(),
      message: v.string(),
    }),
  ),
  handler: async (ctx, args): Promise<HandleResult> => {
    const toleranceSeconds = args.toleranceSeconds ?? 300;
    if (
      !Number.isFinite(toleranceSeconds) ||
      toleranceSeconds < 1 ||
      toleranceSeconds > 3600
    ) {
      return {
        kind: "error" as const,
        status: 400,
        message: "Invalid webhook timestamp tolerance",
      };
    }

    const timestampSeconds = Number(args.timestamp);
    if (
      !Number.isInteger(timestampSeconds) ||
      Math.abs(Date.now() / 1000 - timestampSeconds) > toleranceSeconds
    ) {
      return {
        kind: "error" as const,
        status: 401,
        message: "Webhook timestamp is outside the allowed window",
      };
    }

    const config: Doc<"webhookConfigs"> | null = args.secretOverride
      ? null
      : await ctx.runQuery(internal.webhooks.getConfig, { scope: args.scope });
    const secret = args.secretOverride ?? config?.secret;
    if (!secret) {
      return {
        kind: "error" as const,
        status: 500,
        message: `No AgentPhone webhook secret configured for scope ${args.scope}`,
      };
    }

    const valid = await verifySignature(
      args.rawBody,
      args.signature,
      args.timestamp,
      secret,
    );
    if (!valid) {
      return {
        kind: "error" as const,
        status: 401,
        message: "Invalid AgentPhone webhook signature",
      };
    }

    const parsed = parseWebhookEvent(args.rawBody);
    if (parsed.kind === "error") {
      return { kind: "error" as const, status: 400, message: parsed.message };
    }

    const inserted: InsertWebhookResult = await ctx.runMutation(
      internal.events.insertWebhook,
      {
        scope: args.scope,
        deliveryId: args.deliveryId,
        payload: parsed.event,
        callback: args.callback,
      },
    );
    return {
      kind: "success" as const,
      duplicate: inserted.duplicate,
      callbackResult: inserted.callbackResult,
    };
  },
});

export const getConfig = internalQuery({
  args: { scope: v.string() },
  returns: v.union(
    v.object({
      ...configFields,
      _id: v.id("webhookConfigs"),
      _creationTime: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("webhookConfigs")
      .withIndex("by_scope", (q) => q.eq("scope", args.scope))
      .first();
  },
});

export const upsertConfig = internalMutation({
  args: configFields,
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertConfigDocument(ctx, args);
    return null;
  },
});

export const deleteConfig = internalMutation({
  args: { scope: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const config = await ctx.db
      .query("webhookConfigs")
      .withIndex("by_scope", (q) => q.eq("scope", args.scope))
      .first();
    if (config) {
      await ctx.db.delete("webhookConfigs", config._id);
    }
    return null;
  },
});

async function upsertConfigDocument(ctx: MutationCtx, args: ConfigArgs) {
  const existing = await ctx.db
    .query("webhookConfigs")
    .withIndex("by_scope", (q) => q.eq("scope", args.scope))
    .first();
  const value = { ...args, updatedAt: Date.now() };
  if (existing) {
    await ctx.db.replace("webhookConfigs", existing._id, value);
  } else {
    await ctx.db.insert("webhookConfigs", value);
  }
}

async function verifySignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  secret: string,
) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`),
  );
  const expected = `sha256=${toHex(digest)}`;
  return constantTimeEqual(signature, expected);
}

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function toHex(value: ArrayBuffer) {
  return Array.from(new Uint8Array(value), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function parseWebhookEvent(
  rawBody: string,
):
  | { kind: "success"; event: WebhookEvent }
  | { kind: "error"; message: string } {
  let value: unknown;
  try {
    value = JSON.parse(rawBody) as unknown;
  } catch {
    return { kind: "error", message: "Webhook body is not valid JSON" };
  }
  if (!isRecord(value)) {
    return { kind: "error", message: "Webhook body must be an object" };
  }
  if (
    typeof value.event !== "string" ||
    typeof value.channel !== "string" ||
    typeof value.timestamp !== "string" ||
    !("data" in value)
  ) {
    return {
      kind: "error",
      message: "Webhook body is missing event, channel, timestamp, or data",
    };
  }
  if (
    value.agentId !== undefined &&
    value.agentId !== null &&
    typeof value.agentId !== "string"
  ) {
    return { kind: "error", message: "Webhook agentId must be a string" };
  }
  if (
    value.recentHistory !== undefined &&
    !Array.isArray(value.recentHistory)
  ) {
    return { kind: "error", message: "Webhook recentHistory must be an array" };
  }
  return { kind: "success", event: value as WebhookEvent };
}

function parseWebhookResponse(
  value: unknown,
): Infer<typeof webhookResponseValidator> {
  if (!isRecord(value)) {
    throw new Error("AgentPhone returned an invalid webhook configuration");
  }
  const requiredStrings = ["id", "url", "secret", "status", "createdAt"];
  for (const key of requiredStrings) {
    if (typeof value[key] !== "string") {
      throw new Error(`AgentPhone webhook response is missing ${key}`);
    }
  }
  if (
    typeof value.contextLimit !== "number" ||
    typeof value.timeout !== "number"
  ) {
    throw new Error("AgentPhone webhook response has invalid limits");
  }
  return value as Infer<typeof webhookResponseValidator>;
}

function validateWebhookOptions(
  contextLimit: number | undefined,
  timeout: number | undefined,
) {
  if (
    contextLimit !== undefined &&
    (!Number.isInteger(contextLimit) || contextLimit < 0 || contextLimit > 50)
  ) {
    throw new Error("contextLimit must be an integer between 0 and 50");
  }
  if (
    timeout !== undefined &&
    (!Number.isInteger(timeout) || timeout < 5 || timeout > 120)
  ) {
    throw new Error("timeout must be an integer between 5 and 120 seconds");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
