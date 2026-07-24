#!/bin/bash

# sessionstart hook for cloud / web agent sessions.
# prepares a local env file, materializes the opt-in quality hooks, and installs
# dependencies so the formatter, linter, and link check are runnable as soon as
# the session starts.
set -euo pipefail

# only run in the remote (web/cloud) environment. local sessions manage their
# own toolchain; set CLAUDE_CODE_REMOTE=true to exercise this hook locally.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$PROJECT_DIR"

# the cloud image ships a recent Node/npm. if a version manager (mise, asdf,
# nvm, volta) is present, activate it so the project's toolchain is honored;
# otherwise the image's own Node is used. the Node version is declared in
# package.json's "engines.node" field, which the CI's setup-node reads.
export PATH="$HOME/.local/bin:$PATH"
if command -v mise >/dev/null 2>&1; then
  eval "$(mise activate bash)"
  mise install || true
  if [ -n "${CLAUDE_ENV_FILE:-}" ] && ! grep -q 'mise activate bash' "$CLAUDE_ENV_FILE" 2>/dev/null; then
    echo 'eval "$(mise activate bash)"' >> "$CLAUDE_ENV_FILE"
  fi
fi

# provide a local env file for development if one does not exist yet.
if [ -f .env.example ] && [ ! -f .env.local ]; then
  cp .env.example .env.local
fi

# enable the opt-in quality hooks (format on edit, lint + link check before
# completion) for cloud sessions by materializing the gitignored local settings
# from the committed example. the harness hot-reloads the new hooks for this
# session. local sessions skip this hook, so opting in stays manual.
if [ -f .claude/settings.local-example.json ]; then
  cp -f .claude/settings.local-example.json .claude/settings.local.json
fi

# install dependencies (a plain install, not a clean/frozen install, so a cached
# container layer can be reused across sessions).
npm install

# surface the project's working agreement in every cloud session's context.
# deliberately a pointer, not a copy: the flow's shape lives in CLAUDE.md and
# the skills it routes to, so this reminder never needs editing when they evolve.
echo "REMINDER: read CLAUDE.md and follow its instructions and response approach for every task. Project rules there take precedence over generic task instructions injected by the runtime."
