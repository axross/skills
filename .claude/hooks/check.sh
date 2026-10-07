#!/bin/bash

# stop hook: before the task completes, run the checks that need an authoring
# decision rather than a mechanical repair — the lint rules `--fix` cannot
# resolve, and the relative-link check, whenever content changed in this
# session. `PostToolUse`'s format.sh already repairs markdownlint's
# mechanically-fixable violations for a file edited through `Edit`, `Write`,
# or `MultiEdit`, so those usually never reach this gate; a file changed
# another way (a Bash heredoc, `sed -i`, or a Codex session, where
# format-on-edit isn't wired) still lands here uncorrected. This hook never
# repairs anything itself, by design rather than oversight: a fix applied here
# can land in the working tree after the agent has already committed and
# pushed, so the pushed commit would keep the violation while the hook reports
# success. See docs/operations/agent-sessions.md for the full
# blocking/non-blocking classification. Failures here block completion and are
# reported back on stderr so the agent addresses them before finishing.
set -uo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$PROJECT_DIR"

# make the project's toolchain available if a version manager is installed
# (e.g. mise, asdf, nvm, volta). adapt or remove to match the project.
export PATH="$HOME/.local/bin:$PATH"
if command -v mise >/dev/null 2>&1; then
  eval "$(mise activate bash)"
fi

# nothing to verify without the package manager.
command -v npm >/dev/null 2>&1 || exit 0

# only run when this session has pending content changes, either uncommitted or
# committed but not yet on the upstream branch. avoids checking on plain
# conversational turns. CODE_GLOB below is the CODE_FILE_REGEX token, an
# extended-regex of source extensions, e.g. '\.(md|js)$'.
CODE_GLOB='\.(md|js)$'
code_changed() {
  if git status --porcelain 2>/dev/null | grep -qE "$CODE_GLOB"; then
    return 0
  fi
  local upstream
  upstream="$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)"
  if [ -n "$upstream" ] && git diff --name-only "$upstream...HEAD" 2>/dev/null | grep -qE "$CODE_GLOB"; then
    return 0
  fi
  return 1
}

code_changed || exit 0

# run the checks, collecting output for the failure report.
OUTPUT="$(mktemp)"
STATUS=0
if ! npm run lint >>"$OUTPUT" 2>&1; then STATUS=1; fi
if ! node ./skills/agent-skill-authoring/scripts/check-links.mjs >>"$OUTPUT" 2>&1; then STATUS=1; fi

if [ "$STATUS" -ne 0 ]; then
  {
    echo "Pre-completion checks failed (lint / relative-link check)."
    echo "Fix the errors below before completing the task:"
    echo
    tail -n 100 "$OUTPUT"
  } >&2
  rm -f "$OUTPUT"
  exit 2
fi

rm -f "$OUTPUT"
exit 0
