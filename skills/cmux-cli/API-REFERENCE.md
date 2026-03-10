# cmux Socket API Reference

Unix socket API for programmatic control. Every CLI command has a socket equivalent.

## Socket paths

| Build | Path |
|-------|------|
| Release | `/tmp/cmux.sock` |
| Debug | `/tmp/cmux-debug.sock` |
| Override | `CMUX_SOCKET_PATH` env var |

## Protocol

Send newline-terminated JSON with `id`, `method`, `params`:

```json
{"id":"req-1","method":"workspace.list","params":{}}
```

Response:
```json
{"id":"req-1","ok":true,"result":{...}}
```

## Access modes

| Mode | Description |
|------|-------------|
| `off` | Socket disabled |
| `cmuxOnly` | Only cmux-spawned processes (default) |
| `allowAll` | Any local process (`CMUX_SOCKET_MODE=allowAll`) |

## Methods

### Workspaces

| Method | Params |
|--------|--------|
| `workspace.list` | `{}` |
| `workspace.create` | `{}` |
| `workspace.select` | `{"workspace_id":"<id>"}` |
| `workspace.current` | `{}` |
| `workspace.close` | `{"workspace_id":"<id>"}` |

### Surfaces

| Method | Params |
|--------|--------|
| `surface.split` | `{"direction":"right"}` |
| `surface.list` | `{}` |
| `surface.focus` | `{"surface_id":"<id>"}` |
| `surface.send_text` | `{"text":"echo hello\n"}` or `{"surface_id":"<id>","text":"..."}` |
| `surface.send_key` | `{"key":"enter"}` or `{"surface_id":"<id>","key":"enter"}` |

### Notifications

| Method | Params |
|--------|--------|
| `notification.create` | `{"title":"...","body":"..."}` |
| `notification.list` | `{}` |
| `notification.clear` | `{}` |

### System

| Method | Params | Notes |
|--------|--------|-------|
| `system.ping` | `{}` | Returns `{"pong":true}` |
| `system.capabilities` | `{}` | Lists available methods |
| `system.identify` | `{}` | Current context |

## Code examples

### Python

```python
import json, os, socket

SOCKET_PATH = os.environ.get("CMUX_SOCKET_PATH", "/tmp/cmux.sock")

def rpc(method, params=None, req_id=1):
    payload = {"id": req_id, "method": method, "params": params or {}}
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as sock:
        sock.connect(SOCKET_PATH)
        sock.sendall(json.dumps(payload).encode() + b"\n")
        return json.loads(sock.recv(65536).decode())

print(rpc("workspace.list", req_id="ws"))
print(rpc("notification.create", {"title": "Done", "body": "Task complete"}, req_id="n"))
```

### Shell

```bash
SOCK="${CMUX_SOCKET_PATH:-/tmp/cmux.sock}"
echo '{"id":"1","method":"workspace.list","params":{}}' | nc -U "$SOCK"
```

### Build notification pattern

```bash
npm run build
if [ $? -eq 0 ]; then
    cmux notify --title "Build Success" --body "Ready to deploy"
else
    cmux notify --title "Build Failed" --body "Check the logs"
fi
```
