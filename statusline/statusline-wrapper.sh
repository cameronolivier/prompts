#!/bin/bash

input=$(cat)

used_pct=""
total=""
if command -v jq >/dev/null 2>&1; then
  # Sum all 4 current_usage fields — matches used_percentage exactly
  { read -r used_pct; read -r total; } < <(
    jq -r '
      (.context_window.used_percentage // ""),
      ((.context_window.current_usage.input_tokens // 0) +
       (.context_window.current_usage.output_tokens // 0) +
       (.context_window.current_usage.cache_creation_input_tokens // 0) +
       (.context_window.current_usage.cache_read_input_tokens // 0))
    ' <<< "$input" 2>/dev/null
  )
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
git_info=$(echo "$input" | bash "${SCRIPT_DIR}/statusline-command.sh")

token_parts=""
if [ -n "$used_pct" ]; then
  pct_int=$(awk -v p="$used_pct" 'BEGIN {printf "%d", p + 0.5}')
  if [ -n "$total" ] && [ "$total" != "0" ]; then
    if [ "$total" -lt 1000 ]; then
      token_parts="${total}, ${pct_int}%"
    else
      total_k=$(awk -v t="$total" 'BEGIN {printf "%dk", t/1000 + 0.5}')
      token_parts="${total_k}, ${pct_int}%"
    fi
  else
    token_parts="${pct_int}%"
  fi
fi

if [ -n "$token_parts" ]; then
  printf '%s | %s' "$token_parts" "$git_info"
else
  printf '%s' "$git_info"
fi
