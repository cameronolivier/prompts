#!/usr/bin/env bash
# detect-project.sh — emit a JSON snapshot of repo type, package manager, and
# verification commands so /implement and /work skip the file-by-file model
# probe on every invocation.
#
# Usage:
#   detect-project.sh                 # output JSON to stdout
#   detect-project.sh --pretty        # pretty-printed JSON
#   detect-project.sh --field test    # output a single field (test|lint|typecheck|pm|repo|monorepo)
#
# Output shape:
#   {
#     "repo": "owner/name" | null,
#     "main_repo_root": "/abs/path",
#     "package_manager": "pnpm"|"npm"|"yarn"|"bun"|"cargo"|"go"|"uv"|"pip"|null,
#     "lang": "ts"|"rust"|"go"|"python"|null,
#     "monorepo": true|false,
#     "monorepo_tool": "pnpm-workspaces"|"turbo"|"nx"|"lerna"|null,
#     "test_cmd":      "..." | null,
#     "lint_cmd":      "..." | null,
#     "typecheck_cmd": "..." | null,
#     "build_cmd":     "..." | null
#   }
#
# Detection precedence (first match wins): pnpm > yarn > bun > npm; cargo; go; uv > pip.

set -euo pipefail

PRETTY=0
FIELD=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --pretty) PRETTY=1; shift ;;
        --field)  FIELD="$2"; shift 2 ;;
        *) echo "unknown arg: $1" >&2; exit 2 ;;
    esac
done

# --- Resolve repo root (handles worktrees by reporting the main repo) ---
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    MAIN_ROOT=$(git worktree list --porcelain 2>/dev/null | head -1 | sed 's/^worktree //')
    [[ -z "$MAIN_ROOT" ]] && MAIN_ROOT=$(git rev-parse --show-toplevel)
else
    MAIN_ROOT=$(pwd)
fi

cd "$MAIN_ROOT"

# --- Repo name (cached cheap via gh) ---
REPO="null"
if command -v gh >/dev/null 2>&1; then
    R=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null || true)
    [[ -n "$R" ]] && REPO="\"$R\""
fi

# --- Package manager + lang ---
PM=null; LANG=null
if   [[ -f pnpm-lock.yaml ]];        then PM='"pnpm"';  LANG='"ts"'
elif [[ -f yarn.lock ]];             then PM='"yarn"';  LANG='"ts"'
elif [[ -f bun.lockb ]];             then PM='"bun"';   LANG='"ts"'
elif [[ -f package-lock.json ]];     then PM='"npm"';   LANG='"ts"'
elif [[ -f package.json ]];          then PM='"npm"';   LANG='"ts"'
elif [[ -f Cargo.toml ]];            then PM='"cargo"'; LANG='"rust"'
elif [[ -f go.mod ]];                then PM='"go"';    LANG='"go"'
elif [[ -f uv.lock ]];               then PM='"uv"';    LANG='"python"'
elif [[ -f pyproject.toml ]];        then PM='"uv"';    LANG='"python"'
elif [[ -f requirements.txt ]];      then PM='"pip"';   LANG='"python"'
fi

# --- Monorepo ---
MONO=false; MONO_TOOL=null
if   [[ -f pnpm-workspace.yaml ]];   then MONO=true; MONO_TOOL='"pnpm-workspaces"'
elif [[ -f turbo.json ]];            then MONO=true; MONO_TOOL='"turbo"'
elif [[ -f nx.json ]];               then MONO=true; MONO_TOOL='"nx"'
elif [[ -f lerna.json ]];            then MONO=true; MONO_TOOL='"lerna"'
fi

# --- Verification commands ---
# Prefer turbo if present; fall back to native pm scripts. Extract from
# package.json scripts where possible so we report what the project actually
# defines, not what we guess.
script_exists() {
    [[ -f package.json ]] || return 1
    if command -v jq >/dev/null 2>&1; then
        jq -e --arg k "$1" '.scripts[$k] // empty' package.json >/dev/null 2>&1
    else
        grep -q "\"$1\":" package.json
    fi
}

emit_pm_script() {  # $1 = script name
    local pm=$2
    case "$pm" in
        pnpm) echo "pnpm $1" ;;
        yarn) echo "yarn $1" ;;
        bun)  echo "bun run $1" ;;
        npm)  echo "npm run $1" ;;
        *)    echo "" ;;
    esac
}

TEST_CMD=null; LINT_CMD=null; TC_CMD=null; BUILD_CMD=null

case "$LANG" in
    '"ts"')
        if [[ "$MONO_TOOL" == '"turbo"' ]] && script_exists test; then
            TEST_CMD="\"$(emit_pm_script "turbo run test" "${PM//\"/}")\""
            script_exists lint      && LINT_CMD="\"$(emit_pm_script "turbo run lint" "${PM//\"/}")\""
            script_exists typecheck && TC_CMD="\"$(emit_pm_script "turbo run typecheck" "${PM//\"/}")\""
            script_exists build     && BUILD_CMD="\"$(emit_pm_script "turbo run build" "${PM//\"/}")\""
        else
            script_exists test      && TEST_CMD="\"$(emit_pm_script test "${PM//\"/}")\""
            script_exists lint      && LINT_CMD="\"$(emit_pm_script lint "${PM//\"/}")\""
            script_exists typecheck && TC_CMD="\"$(emit_pm_script typecheck "${PM//\"/}")\""
            script_exists build     && BUILD_CMD="\"$(emit_pm_script build "${PM//\"/}")\""
        fi
        ;;
    '"rust"')
        TEST_CMD='"cargo test"'; LINT_CMD='"cargo clippy"'; BUILD_CMD='"cargo build"'
        ;;
    '"go"')
        TEST_CMD='"go test ./..."'; LINT_CMD='"go vet ./..."'; BUILD_CMD='"go build ./..."'
        ;;
    '"python"')
        TEST_CMD='"pytest"'; LINT_CMD='"ruff check"'; TC_CMD='"mypy ."'
        ;;
esac

# --- Emit ---
JSON=$(cat <<EOF
{
  "repo": $REPO,
  "main_repo_root": "$MAIN_ROOT",
  "package_manager": $PM,
  "lang": $LANG,
  "monorepo": $MONO,
  "monorepo_tool": $MONO_TOOL,
  "test_cmd": $TEST_CMD,
  "lint_cmd": $LINT_CMD,
  "typecheck_cmd": $TC_CMD,
  "build_cmd": $BUILD_CMD
}
EOF
)

if [[ -n "$FIELD" ]]; then
    case "$FIELD" in
        test)      echo "${TEST_CMD//\"/}" ;;
        lint)      echo "${LINT_CMD//\"/}" ;;
        typecheck) echo "${TC_CMD//\"/}" ;;
        build)     echo "${BUILD_CMD//\"/}" ;;
        pm)        echo "${PM//\"/}" ;;
        repo)      echo "${REPO//\"/}" ;;
        monorepo)  echo "$MONO" ;;
        root)      echo "$MAIN_ROOT" ;;
        *) echo "unknown field: $FIELD" >&2; exit 2 ;;
    esac
    exit 0
fi

if [[ "$PRETTY" == 1 ]] && command -v jq >/dev/null 2>&1; then
    echo "$JSON" | jq .
else
    echo "$JSON"
fi
