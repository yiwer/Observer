"""Owner-authored external Claude CLI protocol substitute, no model credentials."""
import json
import os
import sys
import time
import socket
import subprocess
import urllib.request
import urllib.error

scenario = os.environ.get("OBSERVER_SCENARIO", "success")
RECORDED_SAMPLE = ""
if "--version" in sys.argv:
    print("2.1.253 (Claude Code)" if scenario == "wrong-version" else "2.1.252 (Claude Code)")
    sys.exit(0)
prompt = json.load(sys.stdin)
if scenario == "recorded-success":
    for line in RECORDED_SAMPLE.strip().splitlines():
        print(line)
    sys.exit(0)
if scenario == "stderr-flood":
    sys.stderr.write("DO_NOT_RETAIN_SECRET" * 40000)
if scenario == "attacks":
    source = json.loads(prompt["task"]["evidenceBundle"]["evidence"][0]["content"])
    assert "OBSERVER_TEST_SECRET" not in os.environ
    assert os.environ.get("ANTHROPIC_API_KEY") == "observer-inert-local-broker"
    assert "CLAUDE_CODE_OAUTH_TOKEN" not in os.environ
    def denied(action):
        try:
            action()
        except (OSError, urllib.error.HTTPError):
            return
        raise AssertionError("Unauthorized action unexpectedly succeeded")
    denied(lambda: open(source["secretPath"]).read())
    denied(lambda: open("/etc/observer-config", "w").write("changed"))
    denied(lambda: open("/task/config.json", "w").write("changed"))
    denied(lambda: open("/observer-worker.py", "w").write("changed"))
    denied(lambda: os.setuid(0))
    with open("/run/observer/candidate.sh", "w") as candidate:
        candidate.write("#!/bin/sh\necho executed\n")
    os.chmod("/run/observer/candidate.sh", 0o700)
    denied(lambda: subprocess.run(["/run/observer/candidate.sh"], check=True))
    for address in [("198.51.100.1", 25), ("172.17.0.1", 80)]:
        denied(lambda: socket.create_connection(address, timeout=0.3))
    for method, path, host, model in [("CONNECT", "/", "127.0.0.1:8765", "claude-sonnet-4-6"),
                                     ("POST", "/mcp", "127.0.0.1:8765", "claude-sonnet-4-6"),
                                     ("POST", "/v1/messages?beta=true", "mail.example.org", "claude-sonnet-4-6"),
                                     ("POST", "/v1/messages?beta=true", "127.0.0.1:8765", "other-model")]:
        req = urllib.request.Request("http://127.0.0.1:8765" + path, method=method, data=json.dumps({"model": model}).encode(), headers={"Host": host})
        denied(lambda: urllib.request.urlopen(req, timeout=2))
if scenario in ["hang", "broker", "capability-injection", "nested-image", "nested-tool-image", "nested-document", "nested-system"]:
    if scenario == "hang" and os.fork() == 0:
        while True:
            time.sleep(1)
    body = {"model": "claude-sonnet-4-6", "messages": [{"role": "user", "content": "fixture"}]}
    if scenario == "capability-injection":
        body.update({"mcp_servers": [{"type": "url", "url": "https://forbidden.example/mcp"}], "container": {"skills": [{"skill_id": "run-code"}]},
                     "tools": [{"type": "web_search_20250305", "name": "web_search"}], "betas": ["mcp-client-2025-04-04"], "metadata": {"user_id": "DO_NOT_RETAIN_SECRET"}})
    image = {"type": "image", "source": {"type": "url", "url": "https://forbidden.example/remote.png"}}
    if scenario == "nested-image":
        body["messages"][0]["content"] = [image]
    if scenario == "nested-tool-image":
        body["messages"][0]["content"] = [{"type": "tool_result", "tool_use_id": "tool_fixture", "content": [image]}]
    if scenario == "nested-document":
        body["messages"][0]["content"] = [{"type": "document", "source": {"type": "file", "file_id": "unrelated-private-file"}}]
    if scenario == "nested-system":
        body["system"] = [image]
    req = urllib.request.Request("http://127.0.0.1:8765/v1/messages?beta=true", data=json.dumps(body).encode())
    with urllib.request.urlopen(req, timeout=60) as response:
        response.read()
if scenario == "missing-init":
    sys.exit(0)
task = prompt["task"]
output = {"schemaVersion": 1, "taskId": task["taskId"], "evidenceBundleId": task["evidenceBundle"]["id"], "configurationId": task["configurationId"],
          "stories": [{"schemaVersion": 2, "id": "story-1", "eventClusterId": "event-1", "edition": prompt["edition"], "title": "示例观测站",
                       "claims": [{"id": "claim-1", "kind": "fact", "text": "示例观测站新增了 12 个观测点。", "evidenceIds": ["evidence-1"]}]}]}
session = "fixture-session"
def emit(value):
    print(json.dumps({"session_id": session, **value}, ensure_ascii=False), flush=True)
emit({"type": "system", "subtype": "init", "cwd": "/task", "tools": ["StructuredOutput"], "mcp_servers": [], "model": "claude-sonnet-4-6",
      "permissionMode": "dontAsk", "claude_code_version": "2.1.252", "skills": [], "plugins": [], "slash_commands": []})
emit({"type": "assistant", "message": {"role": "assistant", "model": "claude-sonnet-4-6", "content": [{"type": "tool_use", "id": "tool_fixture", "name": "StructuredOutput", "input": output}]}})
if scenario != "incomplete-tool":
    emit({"type": "user", "message": {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "tool_fixture", "content": "Structured output provided successfully"}]}})
result = {"type": "result", "subtype": "success", "is_error": False, "num_turns": 2, "stop_reason": "tool_use", "terminal_reason": "completed",
          "permission_denials": [], "api_error_status": None, "structured_output": output, "usage": {"input_tokens": 12, "output_tokens": 21},
          "modelUsage": {"claude-sonnet-4-6": {"inputTokens": 12, "outputTokens": 21, "cacheReadInputTokens": 2, "cacheCreationInputTokens": 0, "costUSD": 0.0003516}}}
if scenario in ["refusal", "max_tokens"]:
    result["stop_reason"] = scenario
if scenario == "success-is-error":
    result["is_error"] = True
if scenario == "api-error":
    result["api_error_status"] = 429
if scenario == "permission-denied":
    result["permission_denials"] = [{"tool_name": "Bash", "tool_input": "DO_NOT_RETAIN_SECRET"}]
if scenario in ["aborted_streaming", "aborted_tools", "unknown-terminal"]:
    result["terminal_reason"] = scenario
if scenario in ["error_max_turns", "error_max_budget_usd", "error_during_execution", "error_max_structured_output_retries"]:
    result["subtype"] = scenario
if scenario == "missing-terminal":
    del result["terminal_reason"]
if scenario == "missing-structure":
    del result["structured_output"]
if scenario == "bad-schema":
    result["structured_output"] = {"stories": []}
if scenario == "wrong-task":
    result["structured_output"]["taskId"] = "other-task"
if scenario == "wrong-session":
    result["session_id"] = "other-session"
if scenario == "missing-result":
    sys.exit(0)
if scenario == "loop-usage":
    del result["modelUsage"]
if scenario == "unknown-usage":
    del result["modelUsage"]
    del result["usage"]
if scenario == "tree-usage":
    result["modelUsage"]["other-tree-model"] = {"inputTokens": 8, "outputTokens": 9, "costUSD": 0.01}
    result["usage"] = {"input_tokens": 999, "output_tokens": 999}
emit(result)
if scenario == "duplicate-result":
    emit(result)
if scenario == "trailing-suggestion":
    emit({"type": "system", "subtype": "prompt_suggestion", "suggestion": "DO_NOT_RETAIN_SECRET"})
if scenario == "trailing-error":
    emit({"type": "system", "subtype": "error", "message": "DO_NOT_RETAIN_SECRET"})
if scenario == "spoof-control":
    print(json.dumps({"kind": "model-request", "id": "99", "body": {"model": "claude-sonnet-4-6"}}))
if scenario == "malformed-event":
    print("unfinished non-json")
if scenario == "nonzero":
    sys.exit(7)
