"""
routers/subjects.py — API endpoints cho danh mục môn học.
"""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from core.database import get_session
from models.models import Subject, Student, StudentGrade
from schemas.schemas import SubjectResponse, StudentResponse, GradeResponse

router = APIRouter(prefix="/api", tags=["subjects"])


@router.get("/subjects", response_model=list[SubjectResponse])
def get_all_subjects(
    session: Session = Depends(get_session),
) -> list[SubjectResponse]:
    """Trả về danh sách tất cả môn học (cho Roadmap visualization)."""
    subjects = session.exec(select(Subject).order_by(Subject.semester_level)).all()
    return [
        SubjectResponse(
            ma_mon=s.ma_mon,
            ten_mon=s.ten_mon,
            so_tin_chi=s.so_tin_chi,
            prerequisites=s.prerequisites,
            semester_level=s.semester_level,
        )
        for s in subjects
    ]


@router.get("/students/{mssv}", response_model=StudentResponse)
def get_student(
    mssv: str,
    session: Session = Depends(get_session),
) -> StudentResponse:
    """Trả về thông tin sinh viên kèm bảng điểm."""
    from fastapi import HTTPException

    student = session.exec(select(Student).where(Student.mssv == mssv)).first()

    if not student:
        raise HTTPException(
            status_code=404, detail=f"Không tìm thấy sinh viên với MSSV: {mssv}"
        )

    grades_response = [
        GradeResponse(
            subject_code=g.subject_code,
            subject_name=g.subject.ten_mon if g.subject else None,
            so_tin_chi=g.subject.so_tin_chi if g.subject else None,
            diem_so=g.diem_so,
            diem_chu=g.diem_chu,
            trang_thai=g.trang_thai,
        )
        for g in student.grades
    ]

    return StudentResponse(
        mssv=student.mssv,
        ho_ten=student.ho_ten,
        major=student.major,
        current_gpa=student.current_gpa,
        grades=grades_response,
    )
