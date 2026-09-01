#!/bin/bash

# posttooluse hook: formats the project after a content change so written files
# stay consistent. fires on edit/write tools.
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
# normalize away a trailing slash so the "$PROJECT_DIR"/*.md guard below
# matches reliably regardless of how PROJECT_DIR was supplied.
PROJECT_DIR="${PROJECT_DIR%/}"

# read the edited file path from the tool payload on stdin.
FILE_PATH="$(jq -r '.tool_input.file_path // empty' 2>/dev/null || true)"

# only format when a source file the formatter understands changed; skip the
# rest. the case-pattern below is the CODE_FILE_GLOB token, e.g.
# "*.ts | *.tsx | *.js | *.css".
case "$FILE_PATH" in
  *.md | *.js) ;;
  *) exit 0 ;;
esac

cd "$PROJECT_DIR"

# make the project's toolchain available if a version manager is installed
# (e.g. mise, asdf, nvm, volta). adapt or remove to match the project.
export PATH="$HOME/.local/bin:$PATH"
if command -v mise >/dev/null 2>&1; then
  eval "$(mise activate bash)"
fi

# skip silently when the package manager is unavailable (e.g. a local shell
# without the toolchain provisioned).
command -v npm >/dev/null 2>&1 || exit 0

# use a PROJECT_DIR-relative path, not ":$FILE_PATH" (bypasses
# .markdownlint-cli2.jsonc's ignores, risking a tools/evaluation/mocks/
# rewrite); also skips files outside the project root. *.md is the
# LINT_FIX_FILE_GLOB token (cf. CODE_FILE_GLOB above); metacharacter
# behavior: docs/operations/agent-sessions.md.
case "$FILE_PATH" in
  "$PROJECT_DIR"/*.md)
    FILE_REL="${FILE_PATH#"$PROJECT_DIR"/}"
    FILE_REL="${FILE_REL#/}"
    npm run lint:fix -- "$FILE_REL" >/dev/null 2>&1 || true
    ;;
esac

npm run format >/dev/null 2>&1 || true
exit 0
