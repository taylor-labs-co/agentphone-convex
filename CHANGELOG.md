# Changelog

## 0.3.0

- Merge the typed AgentPhone API core with the existing reactive component.
- Add scoped mirrors for agents, numbers, conversations, messages, calls, and
  transcripts, with bounded indexed queries.
- Add explicit sync and backfill actions.
- Add a durable, idempotent outbound queue with retries, cancellation, status
  queries, and test mode.
- Add webhook delivery retries, dead letters, replay, cleanup, and diagnostics.
- Keep synchronous transactional voice callbacks while dispatching other
  callback work asynchronously.
- Expand typed AgentPhone helpers, examples, tests, package metadata, and
  tag-driven npm publishing with provenance.
- Preserve practical 0.2 compatibility aliases and snake-case identifier
  inputs while making the camel-case client canonical.
- Cache fetched call recordings alongside call transcripts.

## 0.2.0

- Initial reactive resource mirrors, outbound queue, sync helpers, and webhook
  operations.

## 0.1.0

- Initial Convex component and AgentPhone client.
