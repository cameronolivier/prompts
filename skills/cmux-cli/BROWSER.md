# cmux Browser Automation

Full browser automation via `cmux browser` commands. Target surfaces positionally or with `--surface`.

```bash
cmux browser open https://example.com          # new browser surface
cmux browser surface:2 navigate https://other   # navigate existing
cmux browser surface:2 url                      # get current URL
```

## Navigation

```bash
cmux browser open <url>                         # open browser
cmux browser open-split <url>                   # open in split
cmux browser surface:2 navigate <url> [--snapshot-after]
cmux browser surface:2 back
cmux browser surface:2 forward
cmux browser surface:2 reload [--snapshot-after]
cmux browser surface:2 url
cmux browser surface:2 focus-webview
cmux browser surface:2 is-webview-focused
```

## Waiting

Block until a condition is met:

```bash
cmux browser surface:2 wait --load-state complete --timeout-ms 15000
cmux browser surface:2 wait --selector "#checkout" --timeout-ms 10000
cmux browser surface:2 wait --text "Order confirmed"
cmux browser surface:2 wait --url-contains "/dashboard"
cmux browser surface:2 wait --function "window.__appReady === true"
```

## DOM interaction

All mutating actions support `--snapshot-after` for verification.

```bash
cmux browser surface:2 click "button[type='submit']" [--snapshot-after]
cmux browser surface:2 dblclick ".item-row"
cmux browser surface:2 hover "#menu"
cmux browser surface:2 focus "#email"
cmux browser surface:2 check "#terms"
cmux browser surface:2 uncheck "#newsletter"
cmux browser surface:2 scroll-into-view "#pricing"
cmux browser surface:2 type "#search" "cmux"           # types character by character
cmux browser surface:2 fill "#email" --text "a@b.com"  # sets value directly
cmux browser surface:2 fill "#email" --text ""          # clear field
cmux browser surface:2 press Enter
cmux browser surface:2 keydown Shift
cmux browser surface:2 keyup Shift
cmux browser surface:2 select "#region" "us-east"
cmux browser surface:2 scroll --dy 800 [--snapshot-after]
cmux browser surface:2 scroll --selector "#log" --dx 0 --dy 400
```

## Inspection

```bash
cmux browser surface:2 snapshot --interactive --compact
cmux browser surface:2 snapshot --selector "main" --max-depth 5
cmux browser surface:2 screenshot --out /tmp/page.png
cmux browser surface:2 get title
cmux browser surface:2 get url
cmux browser surface:2 get text "h1"
cmux browser surface:2 get html "main"
cmux browser surface:2 get value "#email"
cmux browser surface:2 get attr "a.primary" --attr href
cmux browser surface:2 get count ".row"
cmux browser surface:2 get box "#checkout"
cmux browser surface:2 get styles "#total" --property color
cmux browser surface:2 is visible "#checkout"
cmux browser surface:2 is enabled "button[type='submit']"
cmux browser surface:2 is checked "#terms"
```

## Finding elements

```bash
cmux browser surface:2 find role button --name "Continue"
cmux browser surface:2 find text "Order confirmed"
cmux browser surface:2 find label "Email"
cmux browser surface:2 find placeholder "Search"
cmux browser surface:2 find alt "Product image"
cmux browser surface:2 find title "Open settings"
cmux browser surface:2 find testid "save-btn"
cmux browser surface:2 find first ".row"
cmux browser surface:2 find last ".row"
cmux browser surface:2 find nth 2 ".row"
cmux browser surface:2 highlight "#checkout"
```

## JavaScript

```bash
cmux browser surface:2 eval "document.title"
cmux browser surface:2 eval --script "window.location.href"
cmux browser surface:2 addinitscript "window.__ready = true;"
cmux browser surface:2 addscript "document.querySelector('#x')?.focus()"
cmux browser surface:2 addstyle "#banner { display: none !important; }"
```

## Session data

```bash
# Cookies
cmux browser surface:2 cookies get
cmux browser surface:2 cookies get --name session_id
cmux browser surface:2 cookies set session_id abc123 --domain example.com --path /
cmux browser surface:2 cookies clear --name session_id
cmux browser surface:2 cookies clear --all

# Storage
cmux browser surface:2 storage local set theme dark
cmux browser surface:2 storage local get theme
cmux browser surface:2 storage local clear
cmux browser surface:2 storage session set flow onboarding
cmux browser surface:2 storage session get flow

# State save/restore
cmux browser surface:2 state save /tmp/state.json
cmux browser surface:2 state load /tmp/state.json
```

## Tabs

```bash
cmux browser surface:2 tab list
cmux browser surface:2 tab new https://example.com
cmux browser surface:2 tab switch 1
cmux browser surface:2 tab switch surface:7
cmux browser surface:2 tab close
cmux browser surface:2 tab close surface:7
```

## Console & errors

```bash
cmux browser surface:2 console list
cmux browser surface:2 console clear
cmux browser surface:2 errors list
cmux browser surface:2 errors clear
```

## Dialogs

```bash
cmux browser surface:2 dialog accept
cmux browser surface:2 dialog accept "Confirmed"
cmux browser surface:2 dialog dismiss
```

## Frames

```bash
cmux browser surface:2 frame "iframe[name='checkout']"
cmux browser surface:2 click "#pay-now"
cmux browser surface:2 frame main  # back to main frame
```

## Downloads

```bash
cmux browser surface:2 click "a#download"
cmux browser surface:2 download --path /tmp/report.csv --timeout-ms 30000
```

## Common patterns

### Navigate + inspect
```bash
cmux browser open https://example.com/login
cmux browser surface:2 wait --load-state complete --timeout-ms 15000
cmux browser surface:2 snapshot --interactive --compact
```

### Form fill + submit
```bash
cmux browser surface:2 fill "#email" --text "ops@example.com"
cmux browser surface:2 fill "#password" --text "$PASSWORD"
cmux browser surface:2 click "button[type='submit']" --snapshot-after
cmux browser surface:2 wait --text "Welcome"
```

### Debug capture
```bash
cmux browser surface:2 errors list
cmux browser surface:2 console list
cmux browser surface:2 screenshot --out /tmp/debug.png
cmux browser surface:2 snapshot --interactive --compact
```
