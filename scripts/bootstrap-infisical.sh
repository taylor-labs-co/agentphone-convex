#!/usr/bin/env bash
# Install the pinned Infisical CLI into ~/.local/bin.
#
# Conductor cloud workspaces start from a sandbox that has no Infisical CLI, and
# setup runs in a non-interactive shell, so nothing installs it on the way in.
# The version and digests match soljio's scripts/bootstrap-toolchain.sh -- the
# same CLI reads the same organization's secrets, and a release is verified
# before it runs rather than piped from the network into a shell.
#
# Idempotent: an existing copy at the pinned version is left alone.
set -euo pipefail

readonly INFISICAL_VERSION="0.43.109"
readonly INSTALL_DIR="${HOME}/.local/bin"

readonly INFISICAL_DIGESTS="
c70ad86bb1e4a2f57a217a9a74cb35d1ceea1d3dbc5b26554033e68153a882c4  cli_0.43.109_darwin_amd64.tar.gz
b5cfe6320e884eece569b7a5c9908f4c0cbebe221d15af0ad158103050cd4611  cli_0.43.109_darwin_arm64.tar.gz
6a0252fffb0574c27f186a9b8bf2797d03604627e7041b7250032ccc44ff83e7  cli_0.43.109_linux_amd64.tar.gz
17db967bdeb268c4d60b5fe8e93eb6217d5af1a9ff421a83a669678f579b6654  cli_0.43.109_linux_arm64.tar.gz
"

log() { printf '[bootstrap] %s\n' "$*" >&2; }
die() {
  log "$*"
  exit 1
}

artifact() {
  case "$(uname -s)/$(uname -m)" in
    Darwin/arm64 | Darwin/aarch64) echo "cli_${INFISICAL_VERSION}_darwin_arm64.tar.gz" ;;
    Darwin/x86_64) echo "cli_${INFISICAL_VERSION}_darwin_amd64.tar.gz" ;;
    Linux/x86_64) echo "cli_${INFISICAL_VERSION}_linux_amd64.tar.gz" ;;
    Linux/aarch64 | Linux/arm64) echo "cli_${INFISICAL_VERSION}_linux_arm64.tar.gz" ;;
    *) return 1 ;;
  esac
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

export PATH="${INSTALL_DIR}:${PATH}"

if [[ "$(infisical --version 2>/dev/null | head -1)" == *"${INFISICAL_VERSION}"* ]]; then
  log "infisical ${INFISICAL_VERSION} already installed at $(command -v infisical)"
  exit 0
fi

name="$(artifact)" || die "no pinned infisical build for $(uname -s)/$(uname -m)"
expected="$(awk -v want="${name}" '$2 == want {print $1}' <<<"${INFISICAL_DIGESTS}")"
[[ -n "${expected}" ]] || die "no pinned digest for ${name}"

work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT

log "installing infisical ${INFISICAL_VERSION} (${name})"
curl --fail --location --show-error --silent \
  "https://github.com/Infisical/cli/releases/download/v${INFISICAL_VERSION}/${name}" \
  --output "${work}/${name}"

actual="$(sha256_of "${work}/${name}")"
[[ "${actual}" == "${expected}" ]] ||
  die "digest mismatch for ${name}: expected ${expected}, got ${actual}"

tar --extract --gzip --file "${work}/${name}" --directory "${work}" infisical
mkdir -p "${INSTALL_DIR}"
install -m 0755 "${work}/infisical" "${INSTALL_DIR}/infisical"
log "installed $(infisical --version 2>&1 | head -1) at ${INSTALL_DIR}/infisical"
