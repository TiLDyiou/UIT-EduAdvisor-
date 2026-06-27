"""Declarative base class for SQLAlchemy 2 models.

Models in later milestones (students, courses, ...) should inherit from
`Base`. Alembic uses `Base.metadata` for autogenerate.
"""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
