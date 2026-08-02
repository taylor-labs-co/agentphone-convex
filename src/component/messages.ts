import { v } from "convex/values";
import { action, type ActionCtx } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import { agentPhoneRequest } from "./request.js";

const sendStyleValidator = v.union(
  v.literal("celebration"),
  v.literal("fireworks"),
  v.literal("lasers"),
  v.literal("love"),
  v.literal("confetti"),
  v.literal("balloons"),
  v.literal("spotlight"),
  v.literal("echo"),
  v.literal("invisible"),
  v.literal("gentle"),
  v.literal("loud"),
  v.literal("slam"),
);

export const send = action({
  args: {
    token: v.string(),
    scope: v.string(),
    subAccountId: v.optional(v.string()),
    baseUrl: v.optional(v.string()),
    agentId: v.optional(v.string()),
    toNumber: v.optional(v.string()),
    recipients: v.optional(v.array(v.string())),
    body: v.string(),
    mediaUrls: v.optional(v.array(v.string())),
    numberId: v.optional(v.string()),
    fromNumber: v.optional(v.string()),
    channel: v.optional(v.literal("whatsapp")),
    sendStyle: v.optional(sendStyleValidator),
    replyToMessageId: v.optional(v.string()),
    buttons: v.optional(v.array(v.string())),
    list: v.optional(v.any()),
    testMode: v.optional(v.boolean()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    validateRecipients(args.toNumber, args.recipients);
    validateMedia(args.body, args.mediaUrls);

    const body = {
      body: args.body,
      ...(args.agentId && { agent_id: args.agentId }),
      ...(args.toNumber && { to_number: args.toNumber }),
      ...(args.recipients && { recipients: args.recipients }),
      ...(args.mediaUrls && { media_urls: args.mediaUrls }),
      ...(args.numberId && { number_id: args.numberId }),
      ...(args.fromNumber && { from_number: args.fromNumber }),
      ...(args.channel && { channel: args.channel }),
      ...(args.sendStyle && { send_style: args.sendStyle }),
      ...(args.replyToMessageId && {
        reply_to_message_id: args.replyToMessageId,
      }),
      ...(args.buttons && { buttons: args.buttons }),
      ...(args.list !== undefined && { list: args.list }),
    };
    const response = args.testMode
      ? { testMode: true, status: "skipped", kind: "message", args: body }
      : await agentPhoneRequest({
          token: args.token,
          method: "POST",
          path: "messages",
          subAccountId: args.subAccountId,
          baseUrl: args.baseUrl,
          body,
        });

    await recordBestEffort(ctx, args.scope, args.agentId, response);
    return response;
  },
});

function validateRecipients(
  toNumber: string | undefined,
  recipients: string[] | undefined,
) {
  if (Boolean(toNumber) === Boolean(recipients?.length)) {
    throw new Error("Provide exactly one of toNumber or recipients");
  }
  if (recipients && recipients.length < 2) {
    throw new Error("A new iMessage group requires at least two recipients");
  }
}

function validateMedia(body: string, mediaUrls: string[] | undefined) {
  if (mediaUrls && mediaUrls.length > 20) {
    throw new Error("AgentPhone supports at most 20 media URLs per message");
  }
  if (mediaUrls && mediaUrls.length > 1 && body.length > 0) {
    throw new Error("iMessage carousels cannot include a text body");
  }
}

async function recordBestEffort(
  ctx: ActionCtx,
  scope: string,
  agentId: string | undefined,
  response: unknown,
) {
  const record = asRecord(response);
  try {
    await ctx.runMutation(internal.resources.upsertMessagesFromResponse, {
      scope,
      response,
    });
  } catch (error) {
    console.error("AgentPhone message sent but local state sync failed", error);
  }
  try {
    await ctx.runMutation(internal.events.recordApiEvent, {
      scope,
      eventType: "message.sent",
      ...(typeof record.channel === "string" && { channel: record.channel }),
      ...(agentId && { agentId }),
      ...(typeof record.conversation_id === "string" && {
        conversationId: record.conversation_id,
      }),
      ...(typeof record.id === "string" && { messageId: record.id }),
      direction: "outbound",
      payload: response,
    });
  } catch (error) {
    console.error("AgentPhone message sent but event recording failed", error);
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
