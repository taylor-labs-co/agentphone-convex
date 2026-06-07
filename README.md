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

const phone = new AgentPhone(components.agentphone, {
  httpPrefix: "/agentphone",
  // Set true in development if you want send/call helpers to dry-run.
  testMode: false,
});
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

## Local Reactive State

The component stores normalized AgentPhone state in isolated component tables.
Webhook events and SDK reads hydrate agents, numbers, conversations, messages,
calls, call transcripts, and call recordings.

Query those rows from your app for reactive UI without polling AgentPhone:

```ts
const messages = await phone.listMessagesByConversation(ctx, {
  conversationId: "conv_123",
  limit: 25,
});

const state = await phone.getLatestConversationState(ctx, {
  conversationId: "conv_123",
});

const calls = await phone.listCallsByAgent(ctx, { agentId: "agt_123" });
```

The package also exports validators and types for component-owned rows:

```ts
import {
  messageValidator,
  type AgentPhoneMessage,
} from "agentphone-convex";
```

## Durable Outbound Queue

Use the queue helpers when outbound messages or calls should be tracked and
processed durably:

```ts
const { requestId } = await phone.enqueueMessage(ctx, {
  agent_id: "agt_123",
  to_number: "+15551234567",
  body: "Queued from Convex",
  idempotency_key: "welcome:user_123",
  max_attempts: 1,
});

const status = await phone.getOutboundStatus(ctx, { requestId });
```

The queue stores `queued`, `sending`, `sent`, `failed`, and `cancelled` status.
Retries are opt-in through `max_attempts`; only use retries when your AgentPhone
request is safe to repeat.

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
await phone.ensureProjectWebhook(ctx, {
  eventTypes: ["agent.message", "agent.call_ended", "agent.reaction"],
  contextLimit: 10,
});
```

The component:

- Verifies `X-Webhook-Signature` with the stored signing secret.
- Rejects stale `X-Webhook-Timestamp` values outside a five-minute replay window.
- Dedupes `X-Webhook-ID`.
- Records delivery and event audit rows in private component tables.
- Dispatches non-voice callbacks asynchronously with retry and dead-letter tracking.
- Runs `onVoiceMessage` synchronously so it can return a simple JSON voice response.
- Supports per-agent callbacks with `phone.registerCallbacks(ctx, callbacks, { agentId })`.
- Supports replay, failed-delivery listing, and cleanup through the client helper.

You can inspect and repair webhook processing:

```ts
await phone.listFailedWebhookDeliveries(ctx, { limit: 20 });
await phone.replayWebhookDelivery(ctx, { webhookId: "wh_123" });
await phone.cleanupWebhookDeliveries(ctx, {
  olderThanMs: 7 * 24 * 60 * 60 * 1000,
});
```

If you want to mount an app-owned route instead of only using the component
route, register it in `convex/http.ts`:

```ts
import { httpRouter } from "convex/server";
import { AgentPhone } from "agentphone-convex";
import { components } from "./_generated/api.js";

const http = httpRouter();
const phone = new AgentPhone(components.agentphone);

phone.registerRoutes(http);

export default http;
```

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
- Local state: query agents, numbers, conversations, messages, calls, transcripts, recordings, and latest conversation state.
- Durable outbound: enqueue messages, outbound calls, and web calls; query/cancel outbound requests.
- Webhooks: configure/ensure/get/delete/test project webhook, configure/get/delete/test per-agent webhook, provider delivery stats, component delivery audit, failed delivery listing, replay, cleanup.
- Sync: backfill agents, numbers, recent conversations, recent messages, recent calls, and reconcile stored webhook configuration.
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

1. Configure the project webhook with `phone.ensureProjectWebhook`.
2. Run AgentPhone's webhook test endpoint with `phone.testProjectWebhook`.
3. Confirm `phone.listWebhookDeliveries(ctx, { limit: 10 })` shows a new delivery.
4. Confirm the expected callback ran once and local state queries show the event.

## Development

```bash
npm install
npm test
npm run typecheck
npm run build
```

Convex codegen for components requires a linked Convex project. This package includes generated-style stubs so local package typecheck/build works before linking; installing apps should still run normal Convex codegen.
