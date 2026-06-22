#!/usr/bin/env bash
# Syncs Claude Code session hours to mo-reap at most once per 24h.
# Intended to be called by launchd 4x per day; bails early if last sync < 24h ago.

set -euo pipefail

LOCK_FILE="$HOME/.claude/.mo-reap-last-sync"
LOG_FILE="$HOME/.claude/.mo-reap-sync.log"
PLAN_SCRIPT="$HOME/.claude/skills/mo-reap-sync/scripts/plan.py"

# All output appends to the log
exec >> "$LOG_FILE" 2>&1

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# 24h gate
if [[ -f "$LOCK_FILE" ]]; then
    last=$(cat "$LOCK_FILE")
    now=$(date +%s)
    age=$((now - last))
    if [[ $age -lt 86400 ]]; then
        remaining=$((86400 - age))
        log "SKIP: last sync $(( age / 3600 ))h ago, next window in $(( remaining / 3600 ))h $(( (remaining % 3600) / 60 ))m"
        exit 0
    fi
fi

log "START"

# Current week: Monday to today (macOS date arithmetic)
DOW=$(date +%u)          # 1=Mon, 7=Sun
DAYS_BACK=$((DOW - 1))
if [[ $DAYS_BACK -eq 0 ]]; then
    MONDAY=$(date +%Y-%m-%d)
else
    MONDAY=$(date -v-${DAYS_BACK}d +%Y-%m-%d)
fi
TODAY=$(date +%Y-%m-%d)

log "Range: $MONDAY → $TODAY"

if python3 "$PLAN_SCRIPT" --from "$MONDAY" --to "$TODAY" --auto; then
    date +%s > "$LOCK_FILE"
    log "DONE"
else
    log "ERROR: plan.py failed"
    exit 1
fi
