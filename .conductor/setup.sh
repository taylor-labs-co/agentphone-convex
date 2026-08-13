#!/usr/bin/env bash
# Conductor setup script. Runs once per workspace, from the workspace directory,
# in a non-interactive shell -- so it cannot rely on shell rc files to put
# anything on PATH, and a cloud workspace starts from a bare sandbox.
#
# The goal is a workspace where `npm run verify` passes and the Run button
# starts a component dev loop against this workspace's own Convex deployment,
# with no manual step in between.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly REPO_ROOT
cd "${REPO_ROOT}"

# ~/.local/bin holds the Infisical CLI and the cloud computer's
# convex-local-backend-prepare; both are on PATH in a login shell but not here.
export PATH="${HOME}/.local/bin:${PATH}"

log() { printf '[conductor:setup] %s\n' "$*"; }

# npm ci runs the repo's prepare hook, which builds dist/ and the component's
# _generated directory (neither is committed).
log "installing dependencies"
npm ci

bash "${REPO_ROOT}/scripts/bootstrap-infisical.sh"

# Amazon Linux 2023 ships glibc 2.34 and the precompiled convex-local-backend
# needs 2.35, so the cloud computer keeps a 2.35 runtime and this helper points
# the backend at it. Absent on a Mac, where the backend runs as shipped.
if command -v convex-local-backend-prepare >/dev/null 2>&1; then
  convex-local-backend-prepare
fi

# A workspace gets its own disposable deployment rather than sharing one, so
# parallel workspaces cannot overwrite each other's schema or data. A developer
# who already has a deployment configured keeps it: only an unconfigured
# checkout falls back to anonymous mode.
if [[ -z "${CONVEX_DEPLOYMENT:-}" ]] && ! grep -qs '^CONVEX_DEPLOYMENT=' .env.local; then
  export CONVEX_AGENT_MODE=anonymous
  log "no deployment configured; using a local anonymous deployment"
fi

# A local backend binds 3210/3211 by default, so two workspaces running dev on
# one Mac collide. Conductor reserves CONDUCTOR_PORT..CONDUCTOR_PORT+9 per
# workspace; spending two of them here makes run_mode = "concurrent" true rather
# than lucky. Cloud workspaces get no CONDUCTOR_PORT and need none -- each is
# its own sandbox -- so they keep the defaults.
#
# --local-cloud-port and --local-site-port are undocumented (absent from
# `convex dev --help`). If a future CLI drops them the command fails outright on
# an unknown option, which is the failure mode to want here.
convex_ports=()
if [[ -n "${CONDUCTOR_PORT:-}" ]]; then
  convex_ports=(
    --local-cloud-port "$((CONDUCTOR_PORT + 1))"
    --local-site-port "$((CONDUCTOR_PORT + 2))"
  )
fi

log "creating the Convex deployment"
# Expanded this way because macOS bash 3.2 treats "${empty[@]}" as unbound
# under `set -u`.
npx convex dev --once --typecheck-components ${convex_ports[@]+"${convex_ports[@]}"}

# AGENTPHONE_API_KEY and friends live on the deployment, not in the shell --
# component functions read them through process.env inside Convex. Soft by
# design: without them the test suite still runs in test mode.
node scripts/sync-convex-env.mjs "${INFISICAL_ENV:-dev}"

log "done"
