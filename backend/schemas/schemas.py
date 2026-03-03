"""
schemas/schemas.py — Pydantic/SQLModel schemas cho API request/response.
Tách riêng khỏi DB models để kiểm soát dữ liệu expose ra ngoài.
"""

from pydantic import BaseModel
from models.models import GradeStatus


# --- Response Schemas ---


class GradeResponse(BaseModel):
    """Response cho một môn học trong bảng điểm."""

    subject_code: str
    subject_name: str | None = None
    so_tin_chi: int | None = None
    diem_so: float | None = None
    diem_chu: str | None = None
    trang_thai: GradeStatus

    model_config = {"from_attributes": True}


class StudentResponse(BaseModel):
    """Response cho thông tin sinh viên + bảng điểm."""

    mssv: str
    ho_ten: str
    major: str | None = None
    current_gpa: float | None = None
    grades: list[GradeResponse] = []

    model_config = {"from_attributes": True}


class SubjectResponse(BaseModel):
    """Response cho thông tin môn học (dùng cho Roadmap)."""

    ma_mon: str
    ten_mon: str
    so_tin_chi: int
    prerequisites: list[str] | None = None
    semester_level: int

    model_config = {"from_attributes": True}


class TranscriptUploadResponse(BaseModel):
    """Response sau khi upload và parse transcript thành công."""

    success: bool
    message: str
    student: StudentResponse | None = None
    total_grades: int = 0


#Internal DTOs (dùng trong services)


class ParsedGrade(BaseModel):
    """Kết quả parse một dòng điểm từ HTML."""

    ma_mon: str
    ten_mon: str
    so_tin_chi: int | None = None
    diem_so: float | None = None
    diem_chu: str | None = None


class ParsedTranscript(BaseModel):
    """Kết quả parse toàn bộ transcript HTML."""

    mssv: str
    ho_ten: str
    major: str | None = None
    grades: list[ParsedGrade] = []
