#!/bin/bash

# sessionstart hook for cloud / web agent sessions.
# prepares a local env file, materializes the opt-in quality hooks, and installs
# dependencies so the formatter, linter, and link check are runnable as soon as
# the session starts.
set -euo pipefail

# only run in the remote (web/cloud) environment. local sessions manage their
# own toolchain; set CLAUDE_CODE_REMOTE=true to exercise this hook locally.
# a host that is not Claude Code sets no CLAUDE_* variable, so it opts in
# explicitly instead: .codex/hooks.json invokes this script with
# SKILLS_SESSION_BOOTSTRAP=1. sniffing a host-internal variable would be
# guessing at a name this repository does not own.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ] && [ "${SKILLS_SESSION_BOOTSTRAP:-}" != "1" ]; then
  exit 0
fi

if [ "${1:-}" = "--remind" ]; then
  echo "Read the intended checkout's AGENTS.md. For a change, load its Loop Engineering guidance before planning, assigning change work or editing."
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
