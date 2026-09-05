FROM python@sha256:a116514e19457bcb7af7efe9c3dd0b9b71e85b317694e7882a1c52aa15a78134
# Official @openai/codex 0.153.4-linux-x64, verified before extraction.
COPY --chmod=0555 package/vendor/x86_64-unknown-linux-musl/ /opt/codex/
