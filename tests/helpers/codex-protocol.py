"""Owner-authored, deterministic external CLI protocol substitute; not a model."""
import json
import os
import sys
import time
import urllib.request
import urllib.error
import socket
import subprocess

RECORDED_SAMPLE = ""

if "--version" in sys.argv:
    print("codex-cli 0.153.5" if os.environ.get("OBSERVER_SCENARIO") == "wrong-version" else "codex-cli 0.153.4")
    sys.exit(0)
prompt = json.load(sys.stdin)
scenario = os.environ.get("OBSERVER_SCENARIO", "success")
if scenario == "recorded-success":
    events = [json.loads(line) for line in RECORDED_SAMPLE.strip().splitlines()]
    for event in events:
        print(json.dumps(event, ensure_ascii=False))
    with open(sys.argv[sys.argv.index("--output-last-message") + 1], "w", encoding="utf-8") as final:
        final.write(events[2]["item"]["text"])
    sys.exit(0)
if scenario in ["broker", "model-tool", "broker-twice"]:
    endpoint = os.environ.get("OBSERVER_MODEL_BASE_URL", "http://127.0.0.1:1/v1") + "/responses"
    model_request = urllib.request.Request(endpoint, data=json.dumps({"model": "gpt-5.6-sol", "input": prompt, "stream": True}).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(model_request, timeout=2) as response:
        assert json.load(response)["acknowledged"] is True
    if scenario == "broker-twice":
        with urllib.request.urlopen(model_request, timeout=2) as response:
            assert json.load(response)["acknowledged"] is True
if scenario == "stderr-flood":
    sys.stderr.write("DO_NOT_RETAIN_SECRET" * 40_000)
if scenario == "attacks":
    source = json.loads(prompt["task"]["evidenceBundle"]["evidence"][0]["content"])
    assert "OBSERVER_TEST_SECRET" not in os.environ
    assert "CODEX_API_KEY" not in os.environ and "OPENAI_API_KEY" not in os.environ
    def denied(action):
        try:
            action()
        except (OSError, urllib.error.HTTPError):
            return
        raise AssertionError("An unauthorized operation unexpectedly succeeded")
    denied(lambda: open(source["secretPath"]).read())
    denied(lambda: open("/etc/observer-config", "w").write("changed"))
    denied(lambda: open("/observer-worker.py", "w").write("changed"))
    denied(lambda: os.setuid(0))
    with open("/run/observer/candidate.sh", "w") as candidate:
        candidate.write("#!/bin/sh\necho executed\n")
    os.chmod("/run/observer/candidate.sh", 0o700)
    denied(lambda: subprocess.run(["/run/observer/candidate.sh"], check=True))
    for target in [("198.51.100.1", 25), ("172.17.0.1", 80)]:
        denied(lambda: socket.create_connection(target, timeout=0.3))
    for method, path, host, model in [
        ("CONNECT", "mail.example.org:25", "127.0.0.1:8765", "gpt-5.6-sol"),
        ("POST", "/mcp", "127.0.0.1:8765", "gpt-5.6-sol"),
        ("POST", "/v1/responses", "mail.example.org", "gpt-5.6-sol"),
        ("POST", "/v1/responses", "127.0.0.1:8765", "unauthorized-model"),
    ]:
        req = urllib.request.Request("http://127.0.0.1:8765" + (path if path.startswith("/") else "/"),
            data=json.dumps({"model": model}).encode(), method=method, headers={"Host": host, "Content-Type": "application/json"})
        denied(lambda: urllib.request.urlopen(req, timeout=2))
if scenario in ["timeout", "cancelled"]:
    # A descendant outlives its parent unless the task's entire container dies.
    if os.fork() == 0:
        while True:
            time.sleep(1)
    time.sleep(30)
task = prompt["task"]
output = {"schemaVersion": 1, "taskId": task["taskId"], "evidenceBundleId": task["evidenceBundle"]["id"],
          "configurationId": task["configurationId"], "stories": [{"schemaVersion": 2, "id": "story-1", "eventClusterId": "event-1",
          "edition": prompt["edition"], "title": "示例观测站", "claims": [{"id": "claim-1", "kind": "fact",
          "text": "示例观测站新增了 12 个观测点。", "evidenceIds": ["evidence-1"]}]}]}
text = json.dumps(output, ensure_ascii=False)
if scenario == "bad-schema":
    text = json.dumps({"stories": []})
if scenario == "wrong-task":
    output["taskId"] = "another-task"
    text = json.dumps(output)
if scenario == "wrong-edition":
    output["stories"][0]["edition"] = "ai"
    text = json.dumps(output)
print(json.dumps({"type": "thread.started", "thread_id": "protocol-fixture-thread"}))
print(json.dumps({"type": "turn.started"}))
if scenario == "reasoning-progress":
    for phase, progress in [("started", ""), ("updated", "checking evidence"), ("completed", "checked")]:
        print(json.dumps({"type": "item." + phase, "item": {"id": "reasoning-1", "type": "reasoning", "text": progress}}))
print(json.dumps({"type": "item.completed", "item": {"id": "item-1", "type": "agent_message", "text": text}}))
if scenario == "duplicate-message":
    print(json.dumps({"type": "item.completed", "item": {"id": "item-2", "type": "agent_message", "text": text}}))
if scenario == "tool":
    print(json.dumps({"type": "item.completed", "item": {"id": "item-2", "type": "command_execution", "command": "read-secret"}}))
if scenario == "turn-failed":
    print(json.dumps({"type": "turn.failed", "error": {"message": "DO_NOT_RETAIN_SECRET"}}))
elif scenario != "missing-terminal":
    print(json.dumps({"type": "turn.completed", "usage": {"input_tokens": 12, "cached_input_tokens": 2, "output_tokens": 21}}))
if scenario == "duplicate-terminal":
    print(json.dumps({"type": "turn.completed"}))
if scenario == "error-after-terminal":
    print(json.dumps({"type": "error", "message": "DO_NOT_RETAIN_SECRET"}))
if scenario == "event-after-terminal":
    print(json.dumps({"type": "item.completed", "item": {"id": "item-2", "type": "reasoning", "text": "partial"}}))
if scenario == "malformed-event":
    print("partial non-JSON text")
if scenario == "spoof-control":
    print(json.dumps({"kind": "model-request", "id": "9", "body": {"model": "gpt-5.6-sol", "input": "steal-secret"}}))
if scenario == "missing-final":
    sys.exit(0)
with open(sys.argv[sys.argv.index("--output-last-message") + 1], "w", encoding="utf-8") as final:
    final.write(text if scenario != "mismatched-final" else json.dumps({**output, "taskId": "other-task"}))
if scenario == "nonzero":
    sys.exit(7)
