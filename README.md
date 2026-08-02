# AgentPhone for Convex

`agentphone-convex` is a Convex component for building messaging and voice
workflows on [AgentPhone](https://agentphone.ai/). It combines a typed API
client with Convex-native state and operations:

- Direct actions for messages, calls, agents, numbers, conversations, usage, and
  webhook management.
- Scoped, reactive mirrors of agents, numbers, conversations, messages, calls,
  and call transcripts.
- A durable outbound queue with idempotency, retries, cancellation, status
  queries, and a provider-free test mode.
- Signed, replay-protected, deduplicated webhooks with synchronous voice
  responses and retryable asynchronous callbacks.
- Indexed event history and webhook delivery diagnostics.
- Explicit sync helpers for backfills and reconciliation.
- `request()` as a forward-compatible escape hatch for AgentPhone JSON APIs.

## Install

```sh
npm install agentphone-convex
```

Mount the component in `convex/convex.config.ts`:

```ts
import { defineApp } from "convex/server";
import agentphone from "agentphone-convex/convex.config.js";

const app = defineApp();
app.use(agentphone);
export default app;
```

Set the API key on each Convex deployment that will call AgentPhone:

```sh
npx convex env set AGENTPHONE_API_KEY=your_key
```

Create one shared client in the app's `convex/` directory:

```ts
// convex/agentphone.ts
import { AgentPhone } from "agentphone-convex";
import { components } from "./_generated/api.js";

export const agentphone = new AgentPhone(components.agentphone, {
  defaultAgentId: process.env.AGENTPHONE_AGENT_ID,
  defaultNumberId: process.env.AGENTPHONE_NUMBER_ID,
  scope: "default",
});
```

The optional scope isolates all component records, delivery IDs, webhook
secrets, and queue idempotency keys. Use a stable tenant or workspace ID when a
single Convex app serves multiple AgentPhone projects.

## Webhooks and inbound callbacks

Register the HTTP route in `convex/http.ts`:

```ts
import { httpRouter } from "convex/server";
import { agentphone } from "./agentphone.js";

const http = httpRouter();
agentphone.registerRoutes(http);
export default http;
```

Configure AgentPhone once from an internal action:

```ts
import { v } from "convex/values";
import { internalAction } from "./_generated/server.js";
import { agentphone } from "./agentphone.js";

export const configureAgentPhoneWebhook = internalAction({
  args: {},
  returns: v.any(),
  handler: async (ctx) =>
    await agentphone.configureWebhook(ctx, {
      contextLimit: 10,
      timeout: 30,
    }),
});
```

`configureWebhook` uses
`https://YOUR_CONVEX_SITE/agentphone/webhook?scope=default` and stores the
rotating signing secret inside the component. `configureProjectWebhook` is an
alias. Use `configureAgentWebhook(ctx, { agentId })` for an agent override, or
`setWebhookSecret` if the webhook was configured manually.

Callbacks are internal mutations:

```ts
import { v } from "convex/values";
import { eventValidator, voiceResponseValidator } from "agentphone-convex";
import { internal } from "./_generated/api.js";
import { internalMutation } from "./_generated/server.js";
import { agentphone } from "./agentphone.js";

agentphone.incomingEventCallback = internal.agentphone.handleEvent;

export const handleEvent = internalMutation({
  args: { event: eventValidator },
  returns: v.union(voiceResponseValidator, v.null()),
  handler: async (_ctx, { event }) => {
    if (event.event === "agent.message" && event.channel === "voice") {
      return { text: "Let me check that for you." };
    }
    return null;
  },
});
```

Voice callbacks run synchronously in the event-insert transaction so their JSON
response can be returned to AgentPhone; a thrown callback rolls the event back
so the provider can retry. Non-voice callbacks run asynchronously and are
retried with exponential backoff before becoming a dead letter. Use
`incomingMessageCallback`, `reactionCallback`, or `callEndedCallback` to
override the catch-all for a specific event family.

Inspect and operate deliveries with `listWebhookDeliveries`,
`listFailedWebhookDeliveries`, `replayWebhookDelivery`, and
`cleanupWebhookDeliveries`.

## Direct messages and calls

Provider calls belong in Convex actions:

```ts
export const textCustomer = internalAction({
  args: { toNumber: v.string(), body: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => await agentphone.sendMessage(ctx, args),
});

export const callCustomer = internalAction({
  args: { toNumber: v.string() },
  returns: v.any(),
  handler: async (ctx, { toNumber }) =>
    await agentphone.createOutboundCall(ctx, {
      toNumber,
      initialGreeting: "Hi! Is now still a good time?",
    }),
});
```

Successful writes update the local resource mirror and append an API event on a
best-effort basis. Local bookkeeping never turns a successful provider side
effect into a failed action that an app might accidentally retry.

## Durable outbound work

Queue work from a mutation when the app needs idempotency, retries, observable
status, or separation from the user-facing transaction:

```ts
export const queueReminder = internalMutation({
  args: {
    appointmentId: v.string(),
    toNumber: v.string(),
  },
  returns: v.any(),
  handler: async (ctx, args) =>
    await agentphone.enqueueMessage(ctx, {
      toNumber: args.toNumber,
      body: "Your appointment is tomorrow at 10:00 AM.",
      idempotencyKey: `appointment:${args.appointmentId}:reminder`,
      maxAttempts: 3,
    }),
});
```

The queue stores request data, never the API key. Its scheduled actions read
`AGENTPHONE_API_KEY` from the Convex environment. The same model supports
`enqueueOutboundCall` and `enqueueWebCall`. Query or manage work with
`getOutboundStatus`, `listOutboundRequests`, and `cancelOutboundRequest`.

Set `testMode: true` on a direct or queued request—or on the client—to exercise
the component without an API key or provider call.

## Reactive resource mirrors

Webhooks, direct sends/calls, queued work, transcript fetches, and explicit
syncs update scoped component tables. Query them from normal Convex queries:

```ts
import { v } from "convex/values";
import { query } from "./_generated/server.js";
import { agentphone } from "./agentphone.js";

export const conversationState = query({
  args: { conversationId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) =>
    await agentphone.getLatestConversationState(ctx, {
      ...args,
      messageLimit: 25,
    }),
});
```

The client exports validators and inferred types for every mirrored resource.
Available reads include:

- `listLocalAgents`, `getLocalAgent`, `listLocalNumbers`, `getLocalNumber`
- `listLocalConversations`, `getLocalConversation`
- messages by conversation, agent, number, or counterparty
- calls by agent or number, plus `getLocalCallTranscript`
- `getLatestConversationState` for one conversation and its recent messages

All reads are index-backed, default to 50 records, and reject limits above 100.

## Sync and backfill

Use `syncAgents`, `syncNumbers`, `syncConversations`, `syncMessages`, and
`syncCalls` from actions. Each helper fetches one bounded provider page,
normalizes it into the component, and returns `{ synced, response }`.

```ts
const { synced } = await agentphone.syncMessages(ctx, {
  conversationId: "conv_123",
  limit: 100,
});
```

Pagination stays explicit so an app can schedule its own backfill cadence and
respect provider rate limits.

## Event history

The immutable event log is separate from the latest-state resource mirrors. Use
`listEvents`, `listIncoming`, `listOutgoing`, `listEventsByType`,
`listEventsByAgent`, `listEventsByNumber`, `listEventsByConversation`,
`listEventsByCall`, or `getEventByDeliveryId`.

## AgentPhone API coverage

The client includes helpers for agents, voices, agent calls/conversations,
numbers, number messages/calls, conversations, typing indicators, messages,
reactions, calls, transcripts, recordings, usage breakdowns, project and agent
webhooks, and provider delivery statistics.

For a new or less common JSON endpoint:

```ts
const result = await agentphone.request<MyResponse>(ctx, {
  method: "GET",
  path: "usage/daily",
  query: { days: 30 },
});
```

Streaming transcripts and large binary recording responses should use an
app-owned HTTP action rather than passing a stream through Convex values.

## Development

```sh
npm ci
CONVEX_AGENT_MODE=anonymous npx convex dev --once --typecheck-components
npm run verify
npm pack --dry-run
```

See `example/convex/` for a complete backend setup and the
[AgentPhone API docs](https://docs.agentphone.ai/api-reference) for provider
behavior.
