"""init: enable pgvector extension and create migration meta marker.

Revision ID: 0001
Revises:
Create Date: 2026-05-01

This migration intentionally creates almost nothing: M0 is just the
skeleton. We enable `pgvector` here so all later migrations can reference
the `vector` type without a special prelude.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = "0001"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")


def downgrade() -> None:
    op.execute("DROP EXTENSION IF EXISTS vector")
