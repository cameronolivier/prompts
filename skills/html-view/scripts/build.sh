#!/usr/bin/env bash
# html-view build: assemble agent-composed body + bundled design system
# into a single self-contained HTML file, then open it.
#
# Usage:
#   build.sh --body BODY.html --title "Doc Title" --out OUT.html \
#            [--source path/to/source.md] [--no-open]
#
# Mermaid: if the body contains class="mermaid", mermaid.min.js is inlined
# (downloaded once to ~/.cache/html-view/, CDN <script src> fallback offline).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ASSETS_DIR="$SCRIPT_DIR/../assets"
CACHE_DIR="$HOME/.cache/html-view"
MERMAID_VERSION="11"
MERMAID_URL="https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.min.js"

BODY="" TITLE="" OUT="" SOURCE="" OPEN=1

while [[ $# -gt 0 ]]; do
    case $1 in
        --body)    BODY="$2"; shift 2 ;;
        --title)   TITLE="$2"; shift 2 ;;
        --out)     OUT="$2"; shift 2 ;;
        --source)  SOURCE="$2"; shift 2 ;;
        --no-open) OPEN=0; shift ;;
        *) echo "Unknown arg: $1" >&2; exit 1 ;;
    esac
done

[[ -z "$BODY" || -z "$TITLE" || -z "$OUT" ]] && {
    echo "Usage: build.sh --body BODY.html --title TITLE --out OUT.html [--source SRC.md] [--no-open]" >&2
    exit 1
}
[[ ! -f "$BODY" ]] && { echo "Body file not found: $BODY" >&2; exit 1; }

# ---------- Provenance ----------
GENERATED_AT="$(TZ=Africa/Johannesburg date '+%Y-%m-%d %H:%M SAST')"
GIT_SHA=""
if [[ -n "$SOURCE" ]]; then
    SOURCE_DIR="$(cd "$(dirname "$SOURCE")" 2>/dev/null && pwd || true)"
    if [[ -n "$SOURCE_DIR" ]]; then
        GIT_SHA="$(git -C "$SOURCE_DIR" rev-parse --short HEAD 2>/dev/null || true)"
    fi
fi

FOOTER="<span>Generated ${GENERATED_AT}</span>"
[[ -n "$SOURCE" ]] && FOOTER="<span>Source: <code>${SOURCE}</code></span>${FOOTER}"
[[ -n "$GIT_SHA" ]] && FOOTER="${FOOTER}<span>Commit: <code>${GIT_SHA}</code></span>"

# ---------- Mermaid (inline only when used) ----------
MERMAID_BLOCK=""
if grep -q 'class="mermaid"' "$BODY"; then
    mkdir -p "$CACHE_DIR"
    MERMAID_JS="$CACHE_DIR/mermaid.min.js"
    if [[ ! -s "$MERMAID_JS" ]]; then
        echo "Fetching mermaid.min.js to $CACHE_DIR ..." >&2
        curl -fsSL --max-time 30 "$MERMAID_URL" -o "$MERMAID_JS" || true
    fi
    if [[ -s "$MERMAID_JS" ]]; then
        MERMAID_BLOCK="inline:$MERMAID_JS"
    else
        echo "Warning: mermaid download failed; falling back to CDN (needs network to render)." >&2
        MERMAID_BLOCK="cdn:$MERMAID_URL"
    fi
fi

# ---------- Assemble ----------
export HV_TEMPLATE="$ASSETS_DIR/template.html"
export HV_CSS="$ASSETS_DIR/style.css"
export HV_JS="$ASSETS_DIR/app.js"
export HV_BODY="$BODY"
export HV_TITLE="$TITLE"
export HV_FOOTER="$FOOTER"
export HV_OUT="$OUT"
export HV_MERMAID="$MERMAID_BLOCK"

python3 - <<'PYEOF'
import os

def read(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()

template = read(os.environ["HV_TEMPLATE"])
css = read(os.environ["HV_CSS"])
js = read(os.environ["HV_JS"])
body = read(os.environ["HV_BODY"])

mermaid_spec = os.environ.get("HV_MERMAID", "")
mermaid_html = ""
if mermaid_spec:
    init = (
        "<script>mermaid.initialize({startOnLoad:true,"
        "theme:window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'neutral'});"
        "</script>"
    )
    kind, _, ref = mermaid_spec.partition(":")
    if kind == "inline":
        mermaid_html = "<script>\n" + read(ref) + "\n</script>\n" + init
    else:
        mermaid_html = f'<script src="{ref}"></script>\n' + init

out = template
for slot, value in [
    ("{{TITLE}}", os.environ["HV_TITLE"]),
    ("{{CSS}}", css),
    ("{{BODY}}", body),
    ("{{FOOTER}}", os.environ["HV_FOOTER"]),
    ("{{MERMAID}}", mermaid_html),
    ("{{JS}}", js),
]:
    out = out.replace(slot, value)

with open(os.environ["HV_OUT"], "w", encoding="utf-8") as f:
    f.write(out)

print(f"Wrote {os.environ['HV_OUT']} ({len(out):,} bytes)")
PYEOF

if [[ "$OPEN" -eq 1 ]]; then
    open "$OUT"
fi
