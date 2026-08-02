# Contributing

Install dependencies and start a disposable local Convex deployment before
editing:

```sh
npm install
CONVEX_AGENT_MODE=anonymous npx convex dev --once --typecheck-components
```

Before opening a pull request, run:

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm pack --dry-run
```

New event query paths need a schema index, a bounded `.take(...)`, and a test.
New public Convex functions need argument and return validators. Keep external
AgentPhone calls in actions and never log API keys or webhook secrets.
