"""Drop version and effective_year from policy_documents.

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-10
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008"
down_revision: str | Sequence[str] | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_policy_tag_version_year", "policy_documents", type_="unique")
    op.drop_column("policy_documents", "version")
    op.drop_column("policy_documents", "effective_year")
    op.create_unique_constraint(
        "uq_policy_tag_title",
        "policy_documents",
        ["tag", "title"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_policy_tag_title", "policy_documents", type_="unique")
    op.add_column("policy_documents", sa.Column("effective_year", sa.Integer(), nullable=True))
    op.add_column("policy_documents", sa.Column("version", sa.Text(), nullable=True))
    op.execute("UPDATE policy_documents SET effective_year = 2025, version = 'v1' WHERE effective_year IS NULL")
    op.alter_column("policy_documents", "effective_year", nullable=False)
    op.alter_column("policy_documents", "version", nullable=False)
    op.create_unique_constraint(
        "uq_policy_tag_version_year",
        "policy_documents",
        ["tag", "version", "effective_year"],
    )
