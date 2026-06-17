"""M2 onboarding: sync job progress fields + default major for unknown intake.

Revision ID: 0006
Revises: 0005
Create Date: 2026-05-03

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0006"
down_revision: Union[str, Sequence[str], None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("sync_jobs", sa.Column("current_stage", sa.String(length=64), nullable=True))
    op.add_column(
        "sync_jobs",
        sa.Column("progress_percent", sa.Integer(), nullable=True, server_default="0"),
    )
    op.add_column(
        "sync_jobs",
        sa.Column("result_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO majors (code, name)
            SELECT 'UNKNOWN', 'Chưa xác định'
            WHERE NOT EXISTS (SELECT 1 FROM majors WHERE code = 'UNKNOWN');
            """
        )
    )


def downgrade() -> None:
    op.drop_column("sync_jobs", "result_summary")
    op.drop_column("sync_jobs", "progress_percent")
    op.drop_column("sync_jobs", "current_stage")
