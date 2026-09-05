#!/usr/bin/env node
/**
 * Push this repository's Infisical secrets onto the Convex deployment the
 * workspace is pointed at.
 *
 * Convex functions read their configuration from the deployment, not from the
 * shell -- `infisical run -- convex dev` would inject nothing that
 * `process.env` can see inside a function. So the secrets have to be written
 * with `convex env set`, once per workspace, against whatever deployment
 * .env.local names. In a Conductor workspace that is the disposable local
 * deployment created by the setup script; on a developer's machine it is
 * whatever they already use.
 *
 * Deliberately soft: every failure here logs loudly and exits 0. A missing
 * AgentPhone key costs you the live-call paths and nothing else -- the suite
 * runs in the component's provider-free test mode -- and failing the whole
 * workspace setup over it would be a much worse trade.
 *
 * Usage: node scripts/sync-convex-env.mjs [dev|staging|prod]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Later paths win, so a repository-specific value can override a shared one.
const SECRET_PATHS = ["/shared", "/convex"];

const environment = process.argv[2] ?? process.env.INFISICAL_ENV ?? "dev";

const log = (message) => console.log(`[convex-env] ${message}`);

/** Exits the process rather than throwing: see the "deliberately soft" note. */
function skip(reason) {
  log(reason);
  log("skipping the Convex environment sync");
  process.exit(0);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

function projectId() {
  if (process.env.INFISICAL_PROJECT_ID) {
    return process.env.INFISICAL_PROJECT_ID;
  }

  const configPath = join(REPO_ROOT, ".infisical.json");
  if (!existsSync(configPath)) {
    return null;
  }

  return JSON.parse(readFileSync(configPath, "utf8")).workspaceId ?? null;
}

/**
 * Universal Auth when machine-identity credentials are present (every Conductor
 * cloud workspace), otherwise whatever `infisical login` session the developer
 * already has. Returns the token to pass along, or null to use the session.
 */
function authenticate() {
  const { INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_TOKEN } =
    process.env;

  if (INFISICAL_TOKEN) {
    return INFISICAL_TOKEN;
  }
  if (!(INFISICAL_CLIENT_ID && INFISICAL_CLIENT_SECRET)) {
    return null;
  }

  return run("infisical", [
    "login",
    "--method=universal-auth",
    `--client-id=${INFISICAL_CLIENT_ID}`,
    `--client-secret=${INFISICAL_CLIENT_SECRET}`,
    "--silent",
    "--plain",
  ]).trim();
}

function fetchSecrets(workspaceId, token) {
  const secrets = {};

  for (const path of SECRET_PATHS) {
    let exported;
    try {
      exported = run(
        "infisical",
        [
          "export",
          "--format=json",
          `--env=${environment}`,
          `--path=${path}`,
          `--projectId=${workspaceId}`,
          "--silent",
        ],
        {
          env: { ...process.env, ...(token ? { INFISICAL_TOKEN: token } : {}) },
        }
      );
    } catch (error) {
      // A folder that does not exist is not an error worth stopping for: not
      // every repository uses every path in the layout.
      log(`could not read ${path} (${String(error.message).split("\n")[0]})`);
      continue;
    }

    for (const secret of JSON.parse(exported || "[]")) {
      secrets[secret.key] = secret.value;
    }
  }

  return secrets;
}

/** Current deployment values, so an unchanged secret costs no round trip. */
function currentEnv() {
  const current = {};

  try {
    for (const line of run("npx", ["convex", "env", "list"]).split("\n")) {
      const separator = line.indexOf("=");
      if (separator > 0) {
        current[line.slice(0, separator)] = line.slice(separator + 1);
      }
    }
  } catch {
    log(
      "could not read the deployment's current environment; setting all keys"
    );
  }

  return current;
}

const id = projectId();
if (id === null) {
  skip(
    "no Infisical project configured (add .infisical.json or set INFISICAL_PROJECT_ID)"
  );
}

try {
  run("infisical", ["--version"]);
} catch {
  skip("the Infisical CLI is not on PATH");
}

let secrets;
try {
  secrets = fetchSecrets(id, authenticate());
} catch (error) {
  skip(
    `Infisical authentication failed: ${String(error.message).split("\n")[0]}`
  );
}

const keys = Object.keys(secrets).sort();
if (keys.length === 0) {
  skip(`no secrets found in ${SECRET_PATHS.join(", ")} for env ${environment}`);
}

const current = currentEnv();
const changed = keys.filter((key) => current[key] !== secrets[key]);

if (changed.length === 0) {
  log(`deployment already matches Infisical (${keys.length} secrets)`);
  process.exit(0);
}

for (const key of changed) {
  try {
    // `--` before the name: a value starting with a dash -- a PEM key, say --
    // is otherwise read as an unknown option by the CLI's parser.
    run("npx", ["convex", "env", "set", "--", key, secrets[key]]);
    log(`set ${key}`);
  } catch (error) {
    log(`could not set ${key}: ${String(error.message).split("\n")[0]}`);
  }
}

log(`synced ${changed.length} of ${keys.length} secrets from ${environment}`);
