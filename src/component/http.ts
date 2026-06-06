import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server.js";
import { internal } from "./_generated/api.js";
import type { FunctionHandle } from "convex/server";

import {
  normalizeWebhookPayload,
  parseWebhookBody,
} from "./lib/webhookPayload.js";
import { verifyAgentPhoneSignature } from "./lib/webhookSecurity.js";

const http = httpRouter();

http.route({
  path: "/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const rawBody = await request.text();
    const signature = request.headers.get("X-Webhook-Signature") ?? undefined;
    const timestamp = request.headers.get("X-Webhook-Timestamp") ?? undefined;
    const webhookId =
      request.headers.get("X-Webhook-ID") ??
      request.headers.get("X-AgentPhone-Webhook-ID") ??
      crypto.randomUUID();

    let payload: unknown;
    try {
      payload = parseWebhookBody(rawBody);
    } catch (error) {
      return jsonResponse(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        },
        400,
      );
    }

    const normalized = normalizeWebhookPayload(payload);
    const secret = await ctx.runQuery(internal.state.getWebhookSecret, {
      agentId: normalized.agentId,
    });
    if (!secret) {
      return jsonResponse(
        {
          ok: false,
          error: "No AgentPhone webhook secret is configured for this event.",
        },
        401,
      );
    }

    const verified = await verifyAgentPhoneSignature({
      rawBody,
      signature,
      timestamp,
      secret,
    });
    if (!verified) {
      return jsonResponse({ ok: false, error: "Invalid signature." }, 401);
    }

    const recorded = await ctx.runMutation(internal.state.recordWebhookDelivery, {
      webhookId,
      signature,
      timestamp,
      normalized,
      payload,
    });
    if (recorded.duplicate) {
      return jsonResponse({ ok: true, duplicate: true });
    }

    const callbacks = await ctx.runQuery(internal.state.getCallbacksInternal, {});
    const callbackName = normalized.callback;
    const handle = callbackName ? callbacks[callbackName] : undefined;
    if (!callbackName || !handle) {
      await ctx.runMutation(internal.state.markWebhookDelivery, {
        webhookId,
        status: "ignored",
      });
      return jsonResponse({ ok: true, ignored: true });
    }

    if (callbackName === "onVoiceMessage") {
      try {
        const response = await ctx.runAction(
          handle as FunctionHandle<"action">,
          normalized,
        );
        await ctx.runMutation(internal.state.markWebhookDelivery, {
          webhookId,
          status: "dispatched",
        });
        return jsonResponse(response ?? { ok: true });
      } catch (error) {
        await ctx.runMutation(internal.state.markWebhookDelivery, {
          webhookId,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
        return jsonResponse({ ok: false, error: "Voice callback failed." }, 500);
      }
    }

    await ctx.scheduler.runAfter(
      0,
      handle as FunctionHandle<"action">,
      normalized,
    );
    await ctx.runMutation(internal.state.markWebhookDelivery, {
      webhookId,
      status: "dispatched",
    });
    return jsonResponse({ ok: true });
  }),
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default http;
