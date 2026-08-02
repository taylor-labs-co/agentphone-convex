# AgentPhone for Convex — documentation

The [Mintlify](https://mintlify.com) source for the `agentphone-convex`
documentation site. Pages are MDX with YAML frontmatter; navigation, theme, and
site metadata live in `docs.json`.

```
docs/
  index.mdx          Home page
  introduction.mdx   Overview and key capabilities
  quickstart.mdx     Install, configure, send the first message
  concepts/          Component model, scopes, resource mirrors, event history
  guides/            Messaging, voice, webhooks, queue, sync, authorization, test mode
  api/               Reference for the AgentPhone client class and its methods
```

## Preview locally

Install the [Mintlify CLI](https://www.npmjs.com/package/mint) and run it from
this directory, where `docs.json` lives:

```sh
npm i -g mint
cd docs
mint dev
```

The preview is served at `http://localhost:3000`. Run `mint update` if the dev
server fails to start on an older CLI version.

## Publishing

Changes are deployed by the Mintlify GitHub app after they land on the default
branch. Adding a new page takes two steps: create the MDX file, then add its
path to the matching group in `docs.json` — otherwise the page is reachable by
URL but missing from the sidebar.

Keep the docs in sync with the public API surface described in the repository
root `README.md`.
