# Changelog

## 0.4.0

### Breaking

- Webhook callbacks now receive `{ event, scope }` instead of `{ event }`, so a
  handler can tell which tenant a delivery belongs to. Update each callback's
  argument validators — spreading the new `eventCallbackArgs` export keeps them
  correct through future additions:

  ```diff
  - args: { event: eventValidator },
  + args: eventCallbackArgs,
  ```

### Added

- Sub-account support for multi-tenant apps: `createSubAccount`,
  `updateSubAccount`, `deleteSubAccount`, `listSubAccounts`, `syncSubAccounts`,
  `adoptSubAccount`, `releaseSubAccountClaim`, `listLocalSubAccounts`, and
  `getLocalSubAccount`.
- `forSubAccount(subAccount, options?)` derives a client bound to a sub-account
  and to a `<scope>:sub:<subAccountId>` component scope, and `subAccountScope`
  exposes that scope. Agent and number defaults are not inherited, because they
  name resources the sub-account cannot see.
- A `subAccounts` registry table that makes provisioning idempotent per tenant
  key: the key is claimed in a transaction before AgentPhone is called, claims
  are released when AgentPhone definitively rejects the create, and unresolved
  claims are reported for explicit recovery instead of risking a duplicate.
  Claims are leased, so releasing one cannot cut in front of a create that is
  still waiting on AgentPhone. An expired `provisioning` claim is demoted to
  `unresolved` rather than deleted, so a late AgentPhone response still finishes
  against the same claim; only a second release frees the key. A late finish
  whose claim was deleted never replaces a newer claim for that key. A registry
  entry's tenant key and sub-account id are never reassigned across an
  existing binding.
- Sub-account management methods throw on a client bound to a sub-account,
  matching AgentPhone's single level of nesting.
- The webhook route accepts any scope derived from the client it was registered
  on, including sub-account and nested agent scopes.

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
- Preserve practical 0.2 compatibility aliases and snake-case identifier inputs
  while making the camel-case client canonical.
- Cache fetched call recordings alongside call transcripts.
- Bind global webhook secret overrides to the configured component scope.
- Store manually configured agent webhook secrets under the agent scope that
  agent webhook configuration and delivery already use.
- Retry outbound queue work only for transport failures so a post-send write
  failure can no longer resend an accepted message or call.
- Treat a success response with an unreadable body as accepted, so a queued
  request whose response cannot be parsed is recorded rather than resent.
- Record an accepted outbound send as `sent` with the storage error even when
  its provider result cannot be written, instead of leaving the request stuck in
  `sending`.
- Fail queued outbound work immediately on definitive AgentPhone rejections
  instead of retrying statuses that cannot succeed.
- Send a stable `Idempotency-Key` on every attempt of a queued outbound send so
  a retry after an ambiguous transport failure is not treated as a new send.
- Accept agent scopes derived from the configured scope on the webhook route
  when a global webhook secret override is set, while still rejecting scopes
  owned by another tenant.

## 0.2.0

- Initial reactive resource mirrors, outbound queue, sync helpers, and webhook
  operations.

## 0.1.0

- Initial Convex component and AgentPhone client.
