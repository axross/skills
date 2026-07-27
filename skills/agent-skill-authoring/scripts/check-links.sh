#!/usr/bin/env bash
#
# check-links.sh — relative-link integrity check for a skill tree's Markdown links.
#
# Walks every Markdown file under the given roots — including the `.claude/`
# dot-directory, which `glob('**/*.md')` sweeps silently skip — and reports
# relative links whose target file does not exist.
#
# Ships with the agent-skill-authoring skill (see
# ../references/cross-referencing.md) so link verification survives template
# adaptation and stays runnable in any project that keeps the skill.
#
# Usage:
#   .claude/skills/agent-skill-authoring/scripts/check-links.sh           # check the whole tree
#   .claude/skills/agent-skill-authoring/scripts/check-links.sh PATH ...  # check specific roots
#
# Exit code 0 = all relative links resolve; 1 = one or more broken links.
# Only links to `.md` targets are checked; `http(s)://`, `mailto:`, and pure
# `#anchor` links are ignored. Illustrative example links inside fenced code
# blocks, inline code spans, and HTML comments are skipped so the
# skill-authoring docs can show `[file.md](./references/file.md)` without
# tripping the check.
#
set -euo pipefail

# Emit one tab-separated record per finding in a Markdown file:
#   link<TAB><target>      a candidate .md link target
#   fence<TAB><line>       the file ended with a fence still open
# HTML comments, fenced code blocks, and inline code spans are stripped first;
# http(s):// and mailto: targets are dropped. POSIX awk — no gawk extensions.
AWK_EXTRACT='
{ content = content $0 "\n" }

END {
  gsub(/\r/, "", content)

  # Drop HTML comments: each "<!--" up to its next "-->". The comment span is
  # replaced by its own newlines so every later line keeps its original number,
  # which the unterminated-fence warning reports. A dangling unclosed "<!--" is
  # kept, matching a non-greedy regex that simply would not match it.
  stripped = ""
  rest = content
  while ((open_at = index(rest, "<!--")) > 0) {
    close_off = index(substr(rest, open_at + 4), "-->")
    if (close_off == 0) break
    span = substr(rest, open_at, close_off + 6)
    stripped = stripped substr(rest, 1, open_at - 1) newlines_of(span)
    rest = substr(rest, open_at + close_off + 6)
  }
  content = stripped rest

  # Fenced blocks are skipped, per the CommonMark opening/closing marker rule in
  # fence_marker below; inline code spans are erased from the surviving lines
  # before link extraction.
  n = split(content, lines, "\n")
  fence_char = ""
  fence_len = 0
  fence_open_at = 0
  for (i = 1; i <= n; i++) {
    line = lines[i]
    marker = fence_marker(line)
    if (fence_char != "") {
      if (marker != "" &&
          substr(marker, 1, 1) == fence_char &&
          length(marker) >= fence_len &&
          !fence_has_info(line)) {
        fence_char = ""
      }
      continue
    }
    if (marker != "") {
      fence_char = substr(marker, 1, 1)
      fence_len = length(marker)
      fence_open_at = i
      continue
    }
    gsub(/`+[^`]+`+/, "", line)
    while (match(line, /\]\([^)]*\.md(#[^)]*)?\)/)) {
      inside = substr(line, RSTART + 2, RLENGTH - 3)
      line = substr(line, RSTART + RLENGTH)
      target = link_target(inside)
      if (target !~ /^(https?:\/\/|mailto:)/) printf "link\t%s\n", target
    }
  }

  # An unterminated fence is legal CommonMark, so it is a warning rather than a
  # failure — but everything after it went unchecked, which is worth saying.
  if (fence_char != "") printf "fence\t%d\n", fence_open_at
}

# A string of just the newlines contained in "text", so a removed span can be
# replaced without shifting the line numbers that follow it.
function newlines_of(text,   count, out) {
  count = split(text, parts, "\n") - 1
  out = ""
  while (count-- > 0) out = out "\n"
  return out
}

# The fence marker a line opens or closes with — 3+ backticks or 3+ tildes after
# optional leading whitespace — or "" when the line is not a fence line.
function fence_marker(line,   trimmed) {
  trimmed = line
  sub(/^[ \t]+/, "", trimmed)
  if (match(trimmed, /^(```+|~~~+)/)) return substr(trimmed, 1, RLENGTH)
  return ""
}

# True when anything but whitespace follows the marker. CommonMark allows an
# info string on the OPENING fence only, so a line carrying one never closes.
function fence_has_info(line,   trimmed, marker, rest) {
  trimmed = line
  sub(/^[ \t]+/, "", trimmed)
  marker = fence_marker(line)
  rest = substr(trimmed, length(marker) + 1)
  gsub(/[ \t]/, "", rest)
  return rest != ""
}

# Split "target#fragment" at the fragment: the target is the prefix up to the
# first ".md" that is followed by "#" or ends the parenthesised text.
function link_target(inside,   pos, next_off, after) {
  pos = index(inside, ".md")
  while (pos > 0) {
    after = substr(inside, pos + 3)
    if (after == "" || substr(after, 1, 1) == "#") return substr(inside, 1, pos + 2)
    next_off = index(after, ".md")
    if (next_off == 0) break
    pos = pos + 2 + next_off
  }
  return inside
}
'

# Markdown files under the roots, sorted and deduplicated: file arguments are
# taken as-is, directory arguments are walked while pruning directories that
# never contain authored Markdown worth checking.
list_markdown_files() {
  local root
  for root in "$@"; do
    if [ -f "$root" ]; then
      case "$root" in *.md) printf '%s\n' "$root" ;; esac
    elif [ -d "$root" ]; then
      find "$root" -type d \( -name .git -o -name node_modules -o -name .next \
        -o -name dist -o -name build -o -name out -o -name coverage \
        -o -name .venv \) -prune -o -type f -name '*.md' -print
    fi
  done | LC_ALL=C sort -u
}

checked=0
links_checked=0
broken_count=0
broken_list=""

while IFS= read -r file; do
  checked=$((checked + 1))
  case "$file" in */*) base="${file%/*}" ;; *) base=. ;; esac
  while IFS="$(printf '\t')" read -r kind value; do
    case "$kind" in
      link)
        links_checked=$((links_checked + 1))
        case "$value" in /*) resolved="$value" ;; *) resolved="$base/$value" ;; esac
        if [ ! -e "$resolved" ]; then
          broken_list="${broken_list}  ${file} -> ${value}
"
          broken_count=$((broken_count + 1))
        fi
        ;;
      fence)
        printf 'warning: unterminated fence in %s (opened at line %s); the rest of the file was not checked\n' \
          "$file" "$value" >&2
        ;;
    esac
  done < <(awk "$AWK_EXTRACT" < "$file")
done < <(list_markdown_files "${@:-.}")

if [ "$broken_count" -gt 0 ]; then
  printf 'BROKEN LINKS (%d) across %d files:\n' "$broken_count" "$checked"
  printf '%s' "$broken_list"
  exit 1
fi
printf 'links OK (%d links across %d Markdown files checked)\n' "$links_checked" "$checked"
