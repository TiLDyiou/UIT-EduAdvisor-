from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import get_current_student, get_db
from app.db.models.core_security import Student
from app.schemas.m3 import (
    GpaOverviewResponse,
    RetakeEstimateRequest,
    RetakeEstimateResponse,
    ReverseCalculateRequest,
    ReverseCalculateResponse,
)
from app.services.academic.gpa import (
    EnrollmentRow,
    compute_cumulative_gpa,
    retake_estimate,
    reverse_calculate,
)
from app.api.v1.tracker import _enrollment_to_row, _load_enrollments

router = APIRouter(tags=["GPA Tools"])



@router.post("/reverse", response_model=ReverseCalculateResponse)
async def gpa_reverse(
    body: ReverseCalculateRequest,
) -> ReverseCalculateResponse:
    result = reverse_calculate(
        current_gpa_10=body.current_gpa_10,
        earned_credits=body.earned_credits,
        target_gpa_10=body.target_gpa_10,
        remaining_credits=body.remaining_credits,
    )
    return ReverseCalculateResponse(
        required_avg_10=result.required_avg_10,
        achievable=result.achievable,
    )


@router.post("/retake", response_model=RetakeEstimateResponse)
async def gpa_retake(
    body: RetakeEstimateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    student: Annotated[Student, Depends(get_current_student)],
) -> RetakeEstimateResponse:
    enrollments = await _load_enrollments(db, student.id)
    
    # Map course_id to list index
    id_to_idx = {e.course_id: i for i, e in enumerate(enrollments)}
    
    retakes_dict = {}
    for r in body.retakes:
        if r.enrollment_id not in id_to_idx:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"enrollment_not_found for course {r.enrollment_id}",
            )
        retakes_dict[id_to_idx[r.enrollment_id]] = r.new_grade_10

    rows = [_enrollment_to_row(e) for e in enrollments]
    result = retake_estimate(rows, retakes_dict)
    return RetakeEstimateResponse(
        old_gpa_10=result.old_gpa_10,
        new_gpa_10=result.new_gpa_10,
        delta_gpa_10=result.delta_gpa_10,
    )
