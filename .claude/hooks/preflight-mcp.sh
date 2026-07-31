#!/bin/bash

# MCP server entry for preflight, named by .mcp.json. the server drains the
# buffer the pre/post-tool hooks write and ships it to New Relic on its own
# timers — nothing here calls its tools, so its value is in running at all.
#
# skips silently unless preflight is both installed and configured. Claude Code
# reports the server as unavailable either way; what the skip avoids is
# preflight's own "Missing required configuration: licenseKey" exception in a
# session that never asked for telemetry. exiting immediately fails the
# connection in well under a second rather than waiting out the 30s connect
# timeout, so an unconfigured session starts no slower.
set -uo pipefail

command -v preflight >/dev/null 2>&1 || exit 0

# the same guard the collector hook applies; see preflight-collector.sh for why
# NR_AI_MODE=local is exempt.
if [ "${NR_AI_MODE:-}" != "local" ]; then
  [ -n "${NEW_RELIC_LICENSE_KEY:-}" ] || exit 0
  [ -n "${NEW_RELIC_ACCOUNT_ID:-}" ] || exit 0
fi

exec preflight --stdio
