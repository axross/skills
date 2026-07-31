#!/bin/bash

# pre/post-tool hook: hands the tool event to preflight's collector, which
# buffers it for preflight's MCP server to drain and ship. the environment half
# of this — allowlist, variables, setup script — is in README.md under
# "Session telemetry".
#
# skips silently unless preflight is both installed and configured, so a
# checkout without it (another contributor's fork, a local session, a cloud
# environment nobody configured) behaves exactly as it would with no hook at
# all. a PreToolUse hook that exits non-zero BLOCKS the tool call, so every path
# here exits 0.
set -uo pipefail

command -v preflight-collector >/dev/null 2>&1 || exit 0

# "configured" is the pair preflight itself validates whenever the mode is not
# local. NR_AI_MODE=local is a deliberate opt-in that needs no credentials, so
# it counts as configured rather than being skipped — otherwise a credentials-
# only test would silently disable the one supported mode that has none.
if [ "${NR_AI_MODE:-}" != "local" ]; then
  [ -n "${NEW_RELIC_LICENSE_KEY:-}" ] || exit 0
  [ -n "${NEW_RELIC_ACCOUNT_ID:-}" ] || exit 0
fi

# stdin passes through untouched, so the hook payload reaches the collector as
# Claude Code wrote it. the result is discarded deliberately: the collector
# documents itself as always exiting 0, and this hook's "never block a tool
# call" guarantee should not rest on that holding.
preflight-collector "$@" || true
exit 0
