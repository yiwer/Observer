FROM python@sha256:a116514e19457bcb7af7efe9c3dd0b9b71e85b317694e7882a1c52aa15a78134
# Official release: signature, pinned signer and binary SHA-256 checked by prepare script.
COPY --chmod=0555 claude /opt/claude
