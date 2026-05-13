from __future__ import annotations

import json
import re
from typing import Any


def truncate_for_log(text: str | None, max_len: int = 80) -> str:
    if not text:
        return ""
    t = text.replace("\n", " ").strip()
    if len(t) <= max_len:
        return t
    return t[: max_len - 3] + "..."


def sanitize_error_message(exc: BaseException) -> str:
    """User-facing / SSE-safe message; no stack traces or provider payloads."""
    name = type(exc).__name__
    if isinstance(exc, TimeoutError):
        return "timeout"
    if "HTTPStatus" in name or "HTTP" in name:
        return "upstream_error"
    return "unexpected_error"


def redact_dict_for_log(data: dict[str, Any]) -> dict[str, Any]:
    """Drop high-sensitivity keys before any structured log."""
    deny = {"message", "messages", "transcript", "content", "text", "prompt", "body"}
    out: dict[str, Any] = {}
    for k, v in data.items():
        lk = str(k).lower()
        if lk in deny or "password" in lk or "token" in lk or "secret" in lk or "key" in lk:
            continue
        if isinstance(v, dict):
            out[k] = redact_dict_for_log(v)
        else:
            out[k] = v
    return out


def parse_json_object_loose(text: str) -> dict[str, Any] | None:
    """Extract first JSON object from model output."""
    text = text.strip()
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
