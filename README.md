# agentphone-convex

Convex component for AgentPhone agents, numbers, messages, conversations, calls, usage, and verified webhooks.

## Install

```bash
npm install agentphone-convex agentphone convex
```

Add the component to your Convex app:

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import { v } from "convex/values";
import agentphone from "agentphone-convex/convex.config.js";

const app = defineApp({
  env: {
    AGENTPHONE_API_KEY: v.string(),
    AGENTPHONE_BASE_URL: v.optional(v.string()),
  },
});

app.use(agentphone, {
  name: "agentphone",
  httpPrefix: "/agentphone",
  env: {
    AGENTPHONE_API_KEY: app.env.AGENTPHONE_API_KEY,
    AGENTPHONE_BASE_URL: app.env.AGENTPHONE_BASE_URL,
  },
});

export default app;
```

Your AgentPhone webhook URL will be:

```text
https://<your-convex-site-url>/agentphone/webhook
```

## Client Helper

```ts
import { AgentPhone } from "agentphone-convex";
import { components } from "./_generated/api.js";

const phone = new AgentPhone(components.agentphone);
```

The helper routes calls to the installed component:

```ts
await phone.createAgent(ctx, {
  name: "Support",
  instructions: "Answer customer questions concisely.",
});

await phone.provisionNumber(ctx, {
  agent_id: "agt_123",
  area_code: "415",
});

await phone.sendMessage(ctx, {
  agent_id: "agt_123",
  to_number: "+15551234567",
  body: "Hello from Convex",
});
```

## Webhooks

Register callback function handles from an app action or mutation:

```ts
import { action } from "./_generated/server.js";
import { api, components } from "./_generated/api.js";
import { AgentPhone } from "agentphone-convex";

const phone = new AgentPhone(components.agentphone);

export const registerAgentPhoneCallbacks = action({
  args: {},
  handler: async (ctx) => {
    await phone.registerCallbacks(ctx, {
      onMessage: api.agentphoneCallbacks.onMessage,
      onVoiceMessage: api.agentphoneCallbacks.onVoiceMessage,
      onCallEnded: api.agentphoneCallbacks.onCallEnded,
      onReaction: api.agentphoneCallbacks.onReaction,
    });
  },
});
```

Then configure AgentPhone to send signed webhooks to the component route:

```ts
await phone.configureProjectWebhook(ctx, {
  url: `${process.env.CONVEX_SITE_URL}/agentphone/webhook`,
  event_types: [
    "agent.message",
    "agent.call_ended",
    "agent.reaction",
  ],
  context_limit: 10,
});
```

The component:

- Verifies `X-Webhook-Signature` with the stored signing secret.
- Rejects stale `X-Webhook-Timestamp` values outside a five-minute replay window.
- Dedupes `X-Webhook-ID`.
- Records delivery and event audit rows in private component tables.
- Dispatches non-voice callbacks asynchronously.
- Runs `onVoiceMessage` synchronously so it can return a simple JSON voice response.

For low-latency voice streaming, use the app-owned helper in your own HTTP route:

```ts
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server.js";
import { components } from "./_generated/api.js";
import { handleAgentPhoneWebhook } from "agentphone-convex";

const http = httpRouter();

http.route({
  path: "/agentphone-voice",
  method: "POST",
  handler: httpAction(async (ctx, request) =>
    handleAgentPhoneWebhook(ctx, components.agentphone, request, {
      onVoiceMessage: async (event) =>
        new Response(
          JSON.stringify({
            messages: [{ type: "text", text: "I can help with that." }],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
    }),
  ),
});

export default http;
```

## API Surface

- Agents: list, create, get, update, delete, attach/detach number, list voices, list agent conversations, list agent calls.
- Numbers: list, provision, release, list number messages.
- Messages: send SMS/iMessage, send iMessage reactions.
- Conversations: list, get, update metadata, list messages, send typing indicator.
- Calls: list, list by number, get, create outbound call, create web call, end, recording, transcript.
- Webhooks: configure/get/delete/test project webhook, configure/get/delete/test per-agent webhook, provider delivery stats, component delivery audit.
- Usage: account, daily, monthly, by number, by agent.

## Testing

The package exports a `convex-test` helper:

```ts
import { convexTest } from "convex-test";
import { registerAgentPhoneComponent } from "agentphone-convex/test";

const t = convexTest();
registerAgentPhoneComponent(t, { componentPath: "agentphone" });
```

Manual smoke path:

1. Configure the project webhook with `phone.configureProjectWebhook`.
2. Run AgentPhone's webhook test endpoint with `phone.testProjectWebhook`.
3. Confirm `phone.listWebhookDeliveries(ctx, { limit: 10 })` shows a new delivery.
4. Confirm the expected callback ran once.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

Convex codegen for components requires a linked Convex project. This package includes generated-style stubs so local package typecheck/build works before linking; installing apps should still run normal Convex codegen.
