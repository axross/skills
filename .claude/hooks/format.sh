#!/bin/bash

# posttooluse hook: formats the project after a content change so written files
# stay consistent. fires on edit/write tools.
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"

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

# repair markdownlint's mechanically-fixable violations before formatting. the
# case-pattern below is the LINT_FIX_FILE_GLOB token, e.g. "*.md" — extend it
# alongside CODE_FILE_GLOB above if this project lints more than Markdown. the
# leading ":" marks the path as literal rather than a glob, since FILE_PATH is
# already absolute; a residual violation `--fix` cannot repair is left in
# place for the Stop hook to catch, so a non-zero exit here is tolerated
# exactly like the format step below.
case "$FILE_PATH" in
  *.md) npm run lint:fix -- ":$FILE_PATH" >/dev/null 2>&1 || true ;;
esac

npm run format >/dev/null 2>&1 || true
exit 0
