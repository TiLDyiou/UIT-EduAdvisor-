"""Pydantic schemas for Milestone 3 – Academic Tracker & GPA Suite."""

from __future__ import annotations

from decimal import Decimal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# GPA
# ---------------------------------------------------------------------------

class GpaOverviewResponse(BaseModel):
    gpa_10: Decimal
    gpa_4: Decimal
    total_credits: int
    earned_credits: int
    daa_dtbc_10: Decimal | None = None
    daa_dtbc_4: Decimal | None = None
    daa_dtbctl_10: Decimal | None = None
    daa_dtbctl_4: Decimal | None = None
    daa_earned_credits: int | None = None


class SimulateEntry(BaseModel):
    course_id: int
    credits: int = Field(ge=1)
    hypothetical_grade_10: Decimal = Field(ge=0, le=10)


class GpaSimulateRequest(BaseModel):
    entries: list[SimulateEntry] = Field(min_length=1)


class GpaSimulateResponse(BaseModel):
    current: GpaOverviewResponse
    simulated: GpaOverviewResponse


class ReverseCalculateRequest(BaseModel):
    target_gpa_10: Decimal = Field(ge=0, le=10)
    remaining_credits: int = Field(ge=1)


class ReverseCalculateResponse(BaseModel):
    required_avg_10: Decimal
    required_avg_4: Decimal
    achievable: bool


class RetakeEstimateRequest(BaseModel):
    enrollment_id: int
    new_grade_10: Decimal = Field(ge=0, le=10)


class RetakeEstimateResponse(BaseModel):
    old_gpa_10: Decimal
    new_gpa_10: Decimal
    delta_gpa_10: Decimal
    old_gpa_4: Decimal
    new_gpa_4: Decimal
    delta_gpa_4: Decimal


# ---------------------------------------------------------------------------
# Roadmap
# ---------------------------------------------------------------------------

class RoadmapNodeResponse(BaseModel):
    course_id: int
    course_code: str
    course_name: str
    credits: int
    term_number: int
    status: str
    grade_10: Decimal | None = None
    grade_4: Decimal | None = None
    grade_letter: str | None = None
    prerequisites_met: bool
    missing_prerequisites: list[str]
    elective_group_id: int | None = None
    elective_group_name: str | None = None
    is_required: bool


class ElectiveGroupStatusResponse(BaseModel):
    group_id: int
    group_name: str
    rule_type: str
    required_value: int
    current_value: int
    fulfilled: bool


class RoadmapResponse(BaseModel):
    nodes: list[RoadmapNodeResponse]
    elective_groups: list[ElectiveGroupStatusResponse]
    is_preview: bool  # True when student has no enrollment data
