"""Structured JSON logging with a per-request correlation id.

`request_id` is a contextvar so every log line emitted while handling a
request automatically carries the same id, even across `await` boundaries.
"""

from __future__ import annotations

import logging
import sys
import uuid
from contextvars import ContextVar
from typing import Any

from pythonjsonlogger.json import JsonFormatter

_request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


def set_request_id(value: str | None) -> None:
    _request_id_ctx.set(value)


def get_request_id() -> str | None:
    return _request_id_ctx.get()


def new_request_id() -> str:
    return uuid.uuid4().hex


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = get_request_id()
        return True


class _JsonFormatter(JsonFormatter):
    def add_fields(
        self,
        log_record: dict[str, Any],
        record: logging.LogRecord,
        message_dict: dict[str, Any],
    ) -> None:
        super().add_fields(log_record, record, message_dict)
        log_record.setdefault("level", record.levelname)
        log_record.setdefault("logger", record.name)
        log_record["request_id"] = getattr(record, "request_id", None)


def configure_logging(level: str = "INFO") -> None:
    """Configure stdout JSON logging once at startup.

    Re-configurable for tests; clears handlers to avoid duplicates.
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    handler.addFilter(_RequestIdFilter())

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level.upper())

    for noisy in ("uvicorn.access",):
        logging.getLogger(noisy).propagate = False
