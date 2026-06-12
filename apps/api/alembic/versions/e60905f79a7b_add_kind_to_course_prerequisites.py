"""Add kind to course_prerequisites

Revision ID: e60905f79a7b
Revises: 0010
Create Date: 2026-06-05 23:50:55.272484

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'e60905f79a7b'
down_revision: Union[str, Sequence[str], None] = '0010'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('course_prerequisites', sa.Column('kind', sa.String(length=32), server_default='prerequisite', nullable=False))


def downgrade() -> None:
    op.drop_column('course_prerequisites', 'kind')
