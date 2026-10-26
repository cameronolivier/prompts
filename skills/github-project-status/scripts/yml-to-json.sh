#!/usr/bin/env bash
# Convert a legacy .github/project.yml (written by older bootstrap.sh) to JSON.
#
# Uses yq when installed. Without yq, parses the nested-map shape bootstrap.sh
# wrote (maps and scalars only, no lists). Validates the result either way, so
# a hand-edited YAML that doesn't parse fails loudly instead of writing junk.
#
# Usage:
#   yml-to-json.sh <in.yml> <out.json>

set -euo pipefail

[[ $# -eq 2 ]] || { echo "usage: $(basename "$0") <in.yml> <out.json>" >&2; exit 1; }
IN="$1"
OUT="$2"

command -v jq >/dev/null || { echo "error: jq not installed" >&2; exit 1; }
[[ -f "$IN" ]] || { echo "error: $IN not found" >&2; exit 1; }

if command -v yq >/dev/null; then
  JSON=$(yq -o=json '.' "$IN" 2>/dev/null || yq '.' "$IN")
else
  # Emit one "<path as JSON array>\t<raw scalar>" line per leaf, then let jq
  # build the object. Indentation decides nesting.
  JSON=$(awk '
    function jstr(s) { gsub(/\\/, "\\\\", s); gsub(/"/, "\\\"", s); return "\"" s "\"" }
    /^[[:space:]]*(#|$)/ { next }
    {
      match($0, /^ */); ind = RLENGTH; line = substr($0, ind + 1)
      if (substr(line, 1, 1) == "\"") {
        i = 2
        while (i <= length(line)) {
          c = substr(line, i, 1)
          if (c == "\\") { i += 2; continue }
          if (c == "\"") break
          i++
        }
        key = substr(line, 1, i); rest = substr(line, i + 1)
      } else {
        p = index(line, ":"); key = jstr(substr(line, 1, p - 1)); rest = substr(line, p)
      }
      sub(/^:[[:space:]]*/, "", rest); sub(/[[:space:]]+$/, "", rest)
      while (depth > 0 && indents[depth] >= ind) depth--
      depth++; indents[depth] = ind; keys[depth] = key
      if (rest == "") next
      path = "["; for (d = 1; d <= depth; d++) path = path (d > 1 ? "," : "") keys[d]; path = path "]"
      print path "\t" rest
    }' "$IN" \
  | jq -Rn '
      reduce (inputs | capture("^(?<p>[^\t]*)\t(?<v>.*)$")) as $l ({};
        setpath($l.p | fromjson;
          $l.v | if startswith("\"") then fromjson
                 elif test("^-?[0-9]+$") then tonumber
                 else . end))')
fi

if ! jq -e '
    (.project.id | type == "string")
    and (.project.number | type == "number")
    and (.project.owner | type == "string")
    and ([.project.fields[] | select(.id and ((.options // {}) | length > 0))] | length > 0)
  ' <<<"$JSON" >/dev/null 2>&1; then
  echo "error: could not convert $IN to JSON (unexpected shape)." >&2
  echo "Regenerate instead: $(dirname "$0")/bootstrap.sh -p $OUT" >&2
  exit 1
fi

jq . <<<"$JSON" > "$OUT"
