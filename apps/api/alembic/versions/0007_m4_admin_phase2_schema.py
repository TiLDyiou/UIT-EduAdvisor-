"""M4 phase 2: admin data model foundations.

Revision ID: 0007
Revises: 0006
Create Date: 2026-05-07
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "0007"
down_revision: str | Sequence[str] | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "courses",
        sa.Column("admin_locked", sa.Boolean(), server_default="false", nullable=False),
    )
    op.add_column("courses", sa.Column("admin_updated_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "admin_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("kind", sa.String(length=32), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("current_stage", sa.String(length=64), nullable=True),
        sa.Column("progress_percent", sa.Integer(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("result_summary", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("input_file_path", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "course_resources",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("course_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("resource_type", sa.String(length=32), nullable=False),
        sa.Column("term_code", sa.String(length=32), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_visible", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "tooltip_terms",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("keyword", sa.Text(), nullable=False),
        sa.Column("normalized_keyword", sa.Text(), nullable=False),
        sa.Column("short_explanation", sa.Text(), nullable=False),
        sa.Column("policy_document_id", sa.BigInteger(), nullable=True),
        sa.Column("policy_url", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["created_by"], ["admin_users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["policy_document_id"], ["policy_documents.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["admin_users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("normalized_keyword"),
    )

    op.create_table(
        "term_course_offerings",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("term_code", sa.String(length=32), nullable=False),
        sa.Column("course_id", sa.BigInteger(), nullable=False),
        sa.Column("source_job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_file_path", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_job_id"], ["admin_jobs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("term_code", "course_id", name="uq_term_course_offering"),
    )

    op.create_table(
        "term_course_sections",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("offering_id", sa.BigInteger(), nullable=False),
        sa.Column("section_code", sa.String(length=32), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=True),
        sa.Column("start_period", sa.Integer(), nullable=True),
        sa.Column("end_period", sa.Integer(), nullable=True),
        sa.Column("room", sa.Text(), nullable=True),
        sa.Column("week_pattern", sa.Text(), nullable=True),
        sa.Column("instructor_name", sa.Text(), nullable=True),
        sa.Column("source_job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["offering_id"], ["term_course_offerings.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_job_id"], ["admin_jobs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "term_exam_schedules",
        sa.Column("id", sa.BigInteger(), sa.Identity(always=False), nullable=False),
        sa.Column("term_code", sa.String(length=32), nullable=False),
        sa.Column("course_id", sa.BigInteger(), nullable=False),
        sa.Column("exam_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("room", sa.Text(), nullable=True),
        sa.Column("kind", sa.String(length=32), nullable=True),
        sa.Column("source_job_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("source_file_path", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_job_id"], ["admin_jobs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "term_code",
            "course_id",
            "exam_date",
            "start_time",
            name="uq_term_exam_schedule_slot",
        ),
    )

    op.add_column("policy_documents", sa.Column("source_filename", sa.Text(), nullable=True))
    op.add_column("policy_documents", sa.Column("mime_type", sa.String(length=128), nullable=True))
    op.add_column("policy_documents", sa.Column("file_size_bytes", sa.BigInteger(), nullable=True))
    op.add_column("policy_documents", sa.Column("content_hash", sa.String(length=128), nullable=True))
    op.add_column(
        "policy_documents",
        sa.Column("chunk_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "policy_documents",
        sa.Column("ingest_job_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_policy_documents_ingest_job",
        "policy_documents",
        "admin_jobs",
        ["ingest_job_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_unique_constraint(
        "uq_policy_tag_version_year",
        "policy_documents",
        ["tag", "version", "effective_year"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_policy_tag_version_year", "policy_documents", type_="unique")
    op.drop_constraint("fk_policy_documents_ingest_job", "policy_documents", type_="foreignkey")
    op.drop_column("policy_documents", "ingest_job_id")
    op.drop_column("policy_documents", "chunk_count")
    op.drop_column("policy_documents", "content_hash")
    op.drop_column("policy_documents", "file_size_bytes")
    op.drop_column("policy_documents", "mime_type")
    op.drop_column("policy_documents", "source_filename")

    op.drop_table("term_exam_schedules")
    op.drop_table("term_course_sections")
    op.drop_table("term_course_offerings")
    op.drop_table("tooltip_terms")
    op.drop_table("course_resources")
    op.drop_table("admin_jobs")
    op.drop_column("courses", "admin_updated_at")
    op.drop_column("courses", "admin_locked")
