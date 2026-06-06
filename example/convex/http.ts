import { httpRouter } from "convex/server";

import { handleAgentPhoneWebhook } from "@taylor-labs/agentphone-convex";

import { components } from "./_generated/api.js";
import { httpAction } from "./_generated/server.js";

const http = httpRouter();

http.route({
  path: "/agentphone-voice",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    handleAgentPhoneWebhook(ctx, components.agentphone, request, {
      onVoiceMessage: async () =>
        new Response(
          JSON.stringify({
            messages: [
              {
                type: "text",
                text: "Thanks, I can help with that.",
              },
            ],
          }),
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        ),
    }),
  ),
});

export default http;
