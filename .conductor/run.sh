#!/usr/bin/env bash
# Conductor run script. Starts the component dev loop: `convex dev` pushing to
# this workspace's deployment, with a watcher rebuilding dist/ and the
# component's generated bindings on every source change.
#
# Runs from the workspace directory in a non-interactive shell, so PATH is set
# up explicitly rather than inherited from shell rc files.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
cd "${REPO_ROOT}"

export PATH="${HOME}/.local/bin:${PATH}"

log() { printf '[conductor:run] %s\n' "$*"; }

if [[ ! -d node_modules ]]; then
  log "node_modules is missing. Run the workspace setup script (.conductor/setup.sh) first."
  exit 1
fi

# The setup script already prepared the backend; repeating it here costs a
# fraction of a second and covers a workspace whose snapshot predates a Convex
# backend release, which would otherwise download an unshimmed binary now.
if command -v convex-local-backend-prepare >/dev/null 2>&1; then
  convex-local-backend-prepare
fi

if [[ -z "${CONVEX_DEPLOYMENT:-}" ]] && ! grep -qs '^CONVEX_DEPLOYMENT=' .env.local; then
  export CONVEX_AGENT_MODE=anonymous
fi

# Same two ports the setup script gave this workspace's backend, so a Mac
# running several workspaces at once keeps them apart. See .conductor/setup.sh
# for why these flags and why they are conditional.
convex_ports=()
if [[ -n "${CONDUCTOR_PORT:-}" ]]; then
  convex_ports=(
    --local-cloud-port "$((CONDUCTOR_PORT + 1))"
    --local-site-port "$((CONDUCTOR_PORT + 2))"
  )
fi

# This is `npm run dev` with the startup race taken out of it.
#
# `convex dev` pushes example/convex, which imports the component through dist/,
# and it watches src/ as well -- so it re-pushes at the same moment the watcher
# rebuilds dist. `npm run dev` loses that race immediately: its watcher runs
# with --initial and rebuilds (`rm -rf dist` first) on top of the build `predev`
# just did, so the very first push reports "Could not resolve
# agentphone-convex/convex.config.js" and the Run pane opens red.
#
# Building once up front and watching for changes only makes the loop start
# clean. It does not close the window on the rebuild after an edit -- see
# .context/INFISICAL_PLAN.md; that one needs a change to `npm run build`, which
# is repository source, not workspace setup.
log "building the component"
npm run build:codegen

log "starting the component dev loop"
exec npx convex dev ${convex_ports[@]+"${convex_ports[@]}"} \
  --start "npx chokidar 'tsconfig*.json' 'src/**/*.ts' -i '**/*.test.ts' -c 'npm run codegen && npx tsc --project ./tsconfig.build.json'"
