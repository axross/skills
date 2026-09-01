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

# repair markdownlint's mechanically-fixable violations before formatting.
# pass the file as a path relative to PROJECT_DIR, as an ordinary glob
# argument — not the ":$FILE_PATH" literal-path form, which bypasses
# .markdownlint-cli2.jsonc's "ignores" (the same exclusion .prettierignore
# encodes for tools/evaluation/mocks/) and would silently rewrite one of
# those walled-off fixtures to this repository's house style. requiring the
# "$PROJECT_DIR"/*.md prefix below skips the fix pass for a file outside the
# project root, where a relative path is meaningless, as well as for any
# other extension. reading the path as a glob was considered risky for a
# filename holding a glob metacharacter (*, ?, [, {, !, #): verified against
# 0.15.0, markdownlint-cli2's glob resolver falls back to a literal-path
# match for most of these and still fixes the file, but a genuinely dynamic
# pattern (e.g. "?") can additionally sweep in an unrelated sibling file
# differing only in that character. "ignores" is still enforced downstream
# either way, so a mock fixture stays protected regardless of how the path
# resolves; a swept-in ordinary file just gets the same mechanical repair
# early, which is accepted as harmless. the case-pattern's *.md suffix is the
# LINT_FIX_FILE_GLOB token — extend it alongside CODE_FILE_GLOB above if this
# project lints more than Markdown. a residual violation `--fix` cannot
# repair is left in place for the Stop hook to catch, so a non-zero exit here
# is tolerated exactly like the format step below.
case "$FILE_PATH" in
  "$PROJECT_DIR"/*.md)
    FILE_REL="${FILE_PATH#"$PROJECT_DIR"/}"
    npm run lint:fix -- "$FILE_REL" >/dev/null 2>&1 || true
    ;;
esac

npm run format >/dev/null 2>&1 || true
exit 0
