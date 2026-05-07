"""Academic schema: courses, enrollments, curricula, prerequisites, elective groups."""

from __future__ import annotations

import uuid
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.db.models.core_security import Major, Student
from app.db.models.mixins import BigIntPkMixin, TimestampMixin, TimestampUpdateMixin


class Course(BigIntPkMixin, TimestampUpdateMixin, Base):
    __tablename__ = "courses"

    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False)
    kind: Mapped[str] = mapped_column(String(32), nullable=False)
    difficulty: Mapped[str | None] = mapped_column(String(16), nullable=True)
    admin_locked: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    admin_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class CourseResource(BigIntPkMixin, TimestampUpdateMixin, Base):
    __tablename__ = "course_resources"

    course_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    resource_type: Mapped[str] = mapped_column(String(32), nullable=False)
    term_code: Mapped[str | None] = mapped_column(String(32), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_visible: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admin_users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admin_users.id", ondelete="SET NULL"),
        nullable=True,
    )

    course: Mapped[Course] = relationship()


class TooltipTerm(BigIntPkMixin, TimestampUpdateMixin, Base):
    __tablename__ = "tooltip_terms"

    keyword: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_keyword: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    short_explanation: Mapped[str] = mapped_column(Text, nullable=False)
    policy_document_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("policy_documents.id", ondelete="SET NULL"),
        nullable=True,
    )
    policy_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admin_users.id", ondelete="SET NULL"),
        nullable=True,
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admin_users.id", ondelete="SET NULL"),
        nullable=True,
    )


class CoursePrerequisite(Base):
    __tablename__ = "course_prerequisites"

    course_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="CASCADE"), primary_key=True
    )
    prerequisite_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("courses.id", ondelete="CASCADE"),
        primary_key=True,
    )

    course: Mapped[Course] = relationship(foreign_keys=[course_id])
    prerequisite: Mapped[Course] = relationship(foreign_keys=[prerequisite_id])


class Enrollment(BigIntPkMixin, TimestampUpdateMixin, Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint(
            "student_id", "course_id", "term_code", name="uq_enrollment_student_course_term"
        ),
    )

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
    )
    course_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    term_code: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    final_grade_10: Mapped[Decimal | None] = mapped_column(Numeric(4, 2), nullable=True)
    final_grade_4: Mapped[Decimal | None] = mapped_column(Numeric(3, 2), nullable=True)

    student: Mapped[Student] = relationship()
    course: Mapped[Course] = relationship()
    grades: Mapped[list[Grade]] = relationship(back_populates="enrollment")


class Grade(BigIntPkMixin, Base):
    __tablename__ = "grades"

    enrollment_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        nullable=False,
    )
    component: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    weight: Mapped[Decimal] = mapped_column(Numeric(6, 4), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    enrollment: Mapped[Enrollment] = relationship(back_populates="grades")


class Schedule(BigIntPkMixin, TimestampMixin, Base):
    __tablename__ = "schedules"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
    )
    course_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    term_code: Mapped[str] = mapped_column(String(32), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    start_period: Mapped[int] = mapped_column(Integer, nullable=False)
    end_period: Mapped[int] = mapped_column(Integer, nullable=False)
    room: Mapped[str | None] = mapped_column(Text, nullable=True)
    week_pattern: Mapped[str | None] = mapped_column(Text, nullable=True)

    student: Mapped[Student] = relationship()
    course: Mapped[Course] = relationship()


class Exam(BigIntPkMixin, TimestampMixin, Base):
    __tablename__ = "exams"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
    )
    course_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    term_code: Mapped[str] = mapped_column(String(32), nullable=False)
    exam_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    room: Mapped[str | None] = mapped_column(Text, nullable=True)
    kind: Mapped[str | None] = mapped_column(String(32), nullable=True)

    student: Mapped[Student] = relationship()
    course: Mapped[Course] = relationship()


class Deadline(BigIntPkMixin, TimestampMixin, Base):
    __tablename__ = "deadlines"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("students.id", ondelete="CASCADE"),
        nullable=False,
    )
    course_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("courses.id", ondelete="SET NULL"),
        nullable=True,
    )
    title: Mapped[str] = mapped_column(Text, nullable=False)
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    student: Mapped[Student] = relationship()
    course: Mapped[Course | None] = relationship()


class Curriculum(BigIntPkMixin, Base):
    __tablename__ = "curricula"

    major_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("majors.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    effective_year: Mapped[int] = mapped_column(Integer, nullable=False)
    total_credits: Mapped[int] = mapped_column(Integer, nullable=False)

    major: Mapped[Major] = relationship(back_populates="curricula")
    terms: Mapped[list[CurriculumTerm]] = relationship(back_populates="curriculum")
    elective_groups: Mapped[list[ElectiveGroup]] = relationship(back_populates="curriculum")


class CurriculumTerm(BigIntPkMixin, Base):
    __tablename__ = "curriculum_terms"
    __table_args__ = (
        UniqueConstraint("curriculum_id", "term_number", name="uq_curriculum_term_number"),
    )

    curriculum_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("curricula.id", ondelete="CASCADE"),
        nullable=False,
    )
    term_number: Mapped[int] = mapped_column(Integer, nullable=False)

    curriculum: Mapped[Curriculum] = relationship(back_populates="terms")
    curriculum_courses: Mapped[list[CurriculumCourse]] = relationship(
        back_populates="curriculum_term"
    )


class CurriculumCourse(Base):
    __tablename__ = "curriculum_courses"

    curriculum_term_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("curriculum_terms.id", ondelete="CASCADE"),
        primary_key=True,
    )
    course_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("courses.id", ondelete="CASCADE"),
        primary_key=True,
    )
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")

    curriculum_term: Mapped[CurriculumTerm] = relationship(back_populates="curriculum_courses")
    course: Mapped[Course] = relationship()


class ElectiveGroup(BigIntPkMixin, Base):
    __tablename__ = "elective_groups"

    curriculum_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("curricula.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Text, nullable=False)
    rule_type: Mapped[str] = mapped_column(String(16), nullable=False)
    required_value: Mapped[int] = mapped_column(Integer, nullable=False)

    curriculum: Mapped[Curriculum] = relationship(back_populates="elective_groups")
    elective_group_courses: Mapped[list[ElectiveGroupCourse]] = relationship(
        back_populates="elective_group"
    )


class ElectiveGroupCourse(Base):
    __tablename__ = "elective_group_courses"

    elective_group_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("elective_groups.id", ondelete="CASCADE"),
        primary_key=True,
    )
    course_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("courses.id", ondelete="CASCADE"),
        primary_key=True,
    )

    elective_group: Mapped[ElectiveGroup] = relationship(back_populates="elective_group_courses")
    course: Mapped[Course] = relationship()


class TermCourseOffering(BigIntPkMixin, TimestampUpdateMixin, Base):
    __tablename__ = "term_course_offerings"
    __table_args__ = (
        UniqueConstraint("term_code", "course_id", name="uq_term_course_offering"),
    )

    term_code: Mapped[str] = mapped_column(String(32), nullable=False)
    course_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    source_job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admin_jobs.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_file_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    course: Mapped[Course] = relationship()
    sections: Mapped[list[TermCourseSection]] = relationship(back_populates="offering")


class TermCourseSection(BigIntPkMixin, TimestampUpdateMixin, Base):
    __tablename__ = "term_course_sections"

    offering_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("term_course_offerings.id", ondelete="CASCADE"),
        nullable=False,
    )
    section_code: Mapped[str] = mapped_column(String(32), nullable=False)
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)
    start_period: Mapped[int | None] = mapped_column(Integer, nullable=True)
    end_period: Mapped[int | None] = mapped_column(Integer, nullable=True)
    room: Mapped[str | None] = mapped_column(Text, nullable=True)
    week_pattern: Mapped[str | None] = mapped_column(Text, nullable=True)
    instructor_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admin_jobs.id", ondelete="SET NULL"),
        nullable=True,
    )

    offering: Mapped[TermCourseOffering] = relationship(back_populates="sections")


class TermExamSchedule(BigIntPkMixin, TimestampUpdateMixin, Base):
    __tablename__ = "term_exam_schedules"
    __table_args__ = (
        UniqueConstraint(
            "term_code",
            "course_id",
            "exam_date",
            "start_time",
            name="uq_term_exam_schedule_slot",
        ),
    )

    term_code: Mapped[str] = mapped_column(String(32), nullable=False)
    course_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("courses.id", ondelete="CASCADE"), nullable=False
    )
    exam_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    room: Mapped[str | None] = mapped_column(Text, nullable=True)
    kind: Mapped[str | None] = mapped_column(String(32), nullable=True)
    source_job_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("admin_jobs.id", ondelete="SET NULL"),
        nullable=True,
    )
    source_file_path: Mapped[str | None] = mapped_column(Text, nullable=True)

    course: Mapped[Course] = relationship()
