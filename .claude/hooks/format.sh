#!/bin/bash

# posttooluse repair is best-effort and limited to one owned file; unresolved
# paths and glob-sensitive names stay for the non-writing completion checks.
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
PROJECT_DIR="${PROJECT_DIR%/}"

FILE_PATH="$(jq -er '.tool_input.file_path | select(type == "string" and length > 0) | select(explode | all(. >= 32 and . != 127))' 2>/dev/null)" || exit 0

case "$FILE_PATH" in
  *.md | *.js) ;;
  *) exit 0 ;;
esac

case "$FILE_PATH" in
  "$PROJECT_DIR"/*) FILE_REL="${FILE_PATH#"$PROJECT_DIR"/}" ;;
  *) exit 0 ;;
esac

IFS= read -r -d '' PROJECT_CANONICAL < <(realpath -ez -- "$PROJECT_DIR" 2>/dev/null) || exit 0
IFS= read -r -d '' FILE_CANONICAL < <(realpath -ez -- "$FILE_PATH" 2>/dev/null) || exit 0
[ -f "$FILE_CANONICAL" ] || exit 0
case "$FILE_CANONICAL" in
  "$PROJECT_CANONICAL"/*.md | "$PROJECT_CANONICAL"/*.js) CANONICAL_REL="${FILE_CANONICAL#"$PROJECT_CANONICAL"/}" ;;
  *) exit 0 ;;
esac

# both identities matter: an installed alias may resolve into editable source,
# and an ordinary-looking source alias may resolve into generated material.
for REL in "$FILE_REL" "$CANONICAL_REL"; do
  case "/$REL/" in
    */../* | */./* | *//*) exit 0 ;;
  esac
  case "$REL" in
    *'*'* | *'?'* | *'['* | *']'* | *'{'* | *'}'* | *'('* | *')'* | *'!'* | *'#'* | *':'* | *'\'* | *[[:cntrl:]]*) exit 0 ;;
    .agents/skills/* | .claude/skills/* | .git/* | */.git/* | node_modules/* | */node_modules/* | tools/evaluation/mocks/*) exit 0 ;;
  esac
done

cd "$PROJECT_CANONICAL" || exit 0

# make the project's toolchain available if a version manager is installed
# (e.g. mise, asdf, nvm, volta). adapt or remove to match the project.
export PATH="$HOME/.local/bin:$PATH"
if command -v mise >/dev/null 2>&1; then
  eval "$(mise activate bash)"
fi

# skip silently when the package manager is unavailable (e.g. a local shell
# without the toolchain provisioned).
command -v npm >/dev/null 2>&1 || exit 0

# ordinary globs preserve lint ignores; colon-literal input bypasses them.
# --no-globs prevents configured positive globs from adding repair targets.
case "$CANONICAL_REL" in
  *.md)
    npm run lint:fix -- --no-globs "./$CANONICAL_REL" >/dev/null 2>&1 || true
    ;;
esac

# the manual format script carries an all-files glob. use the installed CLI
# instead, honoring formatter exclusions at both path identities.
PRETTIER="./node_modules/.bin/prettier"
if [ -x "$PRETTIER" ] &&
  "$PRETTIER" --file-info "./$FILE_REL" 2>/dev/null | jq -e '.ignored == false' >/dev/null 2>&1 &&
  "$PRETTIER" --file-info "./$CANONICAL_REL" 2>/dev/null | jq -e '.ignored == false' >/dev/null 2>&1; then
  "$PRETTIER" --write "./$CANONICAL_REL" >/dev/null 2>&1 || true
fi
exit 0
