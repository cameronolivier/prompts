#!/usr/bin/env bash
# Resolve a containment to a newline-separated list of in-scope source files.
#
# Usage:
#   scope.sh                 # default: current branch's work
#                            #   = files changed vs merge-base(HEAD, base) + uncommitted changes
#   scope.sh --branch        # explicit branch mode (same as default)
#   scope.sh --staged        # staged changes only
#   scope.sh --uncommitted   # working-tree changes only (staged + unstaged)
#   scope.sh --all           # every tracked file in the repo
#   scope.sh --pr <number>   # files in a GitHub PR (needs gh)
#   scope.sh <path> [path…]  # explicit paths / globs (files or dirs)
#
# Env:
#   BASE_BRANCH   override base branch detection (default: main, else master)
#
# Output: one repo-relative file path per line, deduped, existing files only.
# Binary / non-text files are left in — the caller decides what to read.

set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "error: not inside a git repository" >&2
  exit 1
}
cd "$repo_root"

detect_base() {
  if [[ -n "${BASE_BRANCH:-}" ]]; then
    echo "$BASE_BRANCH"; return
  fi
  for b in main master; do
    if git show-ref --verify --quiet "refs/heads/$b"; then echo "$b"; return; fi
  done
  # fall back to the remote default
  git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>/dev/null \
    | sed 's|^origin/||' || echo main
}

emit() {
  # filter to existing files, dedupe, keep stable order
  awk 'NF' | while IFS= read -r f; do [[ -f "$f" ]] && echo "$f"; done \
    | awk '!seen[$0]++'
}

mode="${1:---branch}"

case "$mode" in
  --branch)
    base="$(detect_base)"
    mb="$(git merge-base HEAD "$base" 2>/dev/null || echo "$base")"
    {
      git diff --name-only "$mb"...HEAD 2>/dev/null || true   # committed on branch
      git diff --name-only HEAD 2>/dev/null || true           # unstaged
      git diff --name-only --cached 2>/dev/null || true       # staged
      git ls-files --others --exclude-standard 2>/dev/null    # new untracked
    } | emit
    ;;
  --staged)
    git diff --name-only --cached | emit
    ;;
  --uncommitted)
    {
      git diff --name-only HEAD
      git diff --name-only --cached
      git ls-files --others --exclude-standard
    } | emit
    ;;
  --all)
    git ls-files | emit
    ;;
  --pr)
    [[ $# -ge 2 ]] || { echo "error: --pr needs a number" >&2; exit 1; }
    command -v gh >/dev/null || { echo "error: gh not installed" >&2; exit 1; }
    gh pr diff "$2" --name-only | emit
    ;;
  *)
    # explicit paths / globs — expand dirs to tracked files within them
    for p in "$@"; do
      if [[ -d "$p" ]]; then
        git ls-files -- "$p"
      else
        echo "$p"
      fi
    done | emit
    ;;
esac
