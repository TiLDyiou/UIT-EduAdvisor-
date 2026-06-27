"""SQLAlchemy ORM models. Import order resolves forward references."""

from __future__ import annotations

from app.db.models import (
    academic,  # noqa: F401
    bot,  # noqa: F401
    core_security,  # noqa: F401
    rag_chat,  # noqa: F401
)

__all__ = ["academic", "bot", "core_security", "rag_chat"]
