"""Trusted container supervisor. Source text is stdin data, never a command.

The app supplies this trusted program as argv and task data over stdin. Only
tests mount a protocol substitute. Output lives in private, noexec tmpfs.
"""
import json
import http.server
import os
import queue
import subprocess
import sys
import threading

# The supervisor is the container's PID 1. If its parent broker vanishes, this
# independent deadline exits PID 1 and the runtime kills the remaining tree.
task_seconds = max(1, min(300, int(os.environ["OBSERVER_TASK_TIMEOUT_SECONDS"])))
deadline = threading.Timer(task_seconds, lambda: os._exit(124))
deadline.daemon = True
deadline.start()

output_lock = threading.Lock()

def frame(kind, **fields):
    with output_lock:
        print(json.dumps({"kind": kind, **fields}, ensure_ascii=False), flush=True)


launch = json.loads(sys.stdin.readline())
is_claude = launch.get("provider") == "claude"
os.makedirs(os.environ["CODEX_HOME"], mode=0o700, exist_ok=True)
with open("/run/observer/schema.json", "w", encoding="utf-8") as schema:
    json.dump(launch["schema"], schema)

if launch.get("modelTransport"):
    replies = {}
    next_id = 0

    def receive_replies():
        for line in sys.stdin:
            reply = json.loads(line)
            target = replies.get(reply["id"])
            if target:
                target.put(reply)

    class ModelOnlyBroker(http.server.BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass

        def deny(self, reason):
            frame("refusal", reason=reason)
            self.send_error(403)

        def do_CONNECT(self):
            self.deny("method")

        def do_GET(self):
            self.deny("method")

        def do_POST(self):
            global next_id
            if self.path != ("/v1/messages?beta=true" if is_claude else "/v1/responses"):
                return self.deny("path")
            if self.headers.get("Host") != "127.0.0.1:8765":
                return self.deny("host")
            if self.headers.get("Transfer-Encoding") or self.headers.get("Content-Encoding"):
                return self.deny("encoding")
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 1024 * 1024:
                    return self.deny("request-size")
                body = json.loads(self.rfile.read(length))
                if body.get("model") != launch["model"]:
                    return self.deny("model")
            except (ValueError, AttributeError):
                return self.deny("request")
            next_id += 1
            request_id = str(next_id)
            replies[request_id] = queue.Queue(maxsize=1)
            frame("model-request", id=request_id, body=body)
            try:
                reply = replies[request_id].get(timeout=60)
                payload = reply["body"].encode("utf-8")
                self.send_response(reply["status"])
                self.send_header("Content-Type", "text/event-stream")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            except queue.Empty:
                self.send_error(504)
            finally:
                del replies[request_id]

    threading.Thread(target=receive_replies, daemon=True).start()
    broker = http.server.HTTPServer(("127.0.0.1", 8765), ModelOnlyBroker)
    broker.timeout = 5
    threading.Thread(target=broker.serve_forever, daemon=True).start()
    os.environ["OBSERVER_MODEL_BASE_URL"] = "http://127.0.0.1:8765/v1"
    if is_claude:
        os.environ["ANTHROPIC_BASE_URL"] = "http://127.0.0.1:8765"
        # Inert broker credential, never a real provider key.
        os.environ["ANTHROPIC_API_KEY"] = "observer-inert-local-broker"
if is_claude:
    os.environ["TMPDIR"] = "/run/observer"
    os.environ["CLAUDE_CONFIG_DIR"] = "/run/observer/claude"
    os.environ["DISABLE_UPDATES"] = "1"
    os.environ["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"] = "1"
    os.environ["DISABLE_TELEMETRY"] = "1"
    os.environ["DISABLE_ERROR_REPORTING"] = "1"
version = subprocess.run(launch["program"] + ["--version"], capture_output=True, timeout=10)
actual_version = version.stdout.decode("utf-8", errors="strict").strip()
frame("version", value=actual_version)
if version.returncode != 0 or actual_version != ("2.1.252 (Claude Code)" if is_claude else "codex-cli 0.153.4"):
    sys.exit(78)
child = subprocess.Popen(launch["program"] + launch["args"], stdin=subprocess.PIPE,
                         stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def drain_errors():
    # Raw stderr can contain credentials, copied source text or full URLs.
    # Count it against the host output budget but never forward its contents.
    while chunk := child.stderr.read(4096):
        frame("stderr", bytes=len(chunk))


errors = threading.Thread(target=drain_errors, daemon=True)
errors.start()
child.stdin.write(launch["prompt"].encode("utf-8"))
child.stdin.close()
while line := child.stdout.readline(1024 * 1024 + 1):
    if len(line) > 1024 * 1024:
        sys.exit(74)
    frame("event", line=line.decode("utf-8", errors="strict"))
exit_code = child.wait()
errors.join()
try:
    with open("/run/observer/final.json", encoding="utf-8") as final_file:
        final = final_file.read(2 * 1024 * 1024 + 1)
except FileNotFoundError:
    final = None
frame("result", exitCode=exit_code, final=final)
sys.exit(exit_code if 0 <= exit_code <= 255 else 1)
