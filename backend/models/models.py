"""
models/models.py — SQLModel database models cho UIT EduAdvisor.

3 bảng chính:
- Student: Thông tin sinh viên
- Subject: Danh mục môn học (seed data)
- StudentGrade: Bảng điểm của sinh viên
"""

from enum import Enum
from typing import Optional

from sqlmodel import Field, Relationship, SQLModel, JSON, Column


# --- Enums ---


class GradeStatus(str, Enum):
    """Trạng thái môn học của sinh viên."""

    DAT = "DAT"  
    ROT = "ROT"  
    DANG_HOC = "DANG_HOC" 


# --- Models ---


class Student(SQLModel, table=True):
    """
    Bảng Student — Lưu thông tin cơ bản của sinh viên.
    MSSV là unique identifier từ trường.
    """

    __tablename__ = "students"

    id: Optional[int] = Field(default=None, primary_key=True)
    mssv: str = Field(
        index=True, unique=True, max_length=20, description="Mã số sinh viên"
    )
    ho_ten: str = Field(max_length=100, description="Họ và tên sinh viên")
    major: Optional[str] = Field(default=None, max_length=100, description="Ngành học")
    current_gpa: Optional[float] = Field(
        default=None, ge=0.0, le=10.0, description="GPA hiện tại (thang 10)"
    )

    # Relationship: 1 Student → nhiều StudentGrade
    grades: list["StudentGrade"] = Relationship(back_populates="student")


class Subject(SQLModel, table=True):
    """
    Bảng Subject — Danh mục môn học của chương trình đào tạo.
    Dùng để render Roadmap và map với điểm sinh viên.
    """

    __tablename__ = "subjects"

    id: Optional[int] = Field(default=None, primary_key=True)
    ma_mon: str = Field(
        index=True, unique=True, max_length=20, description="Mã môn học"
    )
    ten_mon: str = Field(max_length=200, description="Tên môn học")
    so_tin_chi: int = Field(default=3, ge=1, le=10, description="Số tín chỉ")

    # Prerequisites: lưu dạng JSON array ["CS101", "CS102"]
    prerequisites: Optional[list[str]] = Field(
        default=None,
        sa_column=Column(JSON, nullable=True),
        description="Danh sách mã môn tiên quyết",
    )

    # Semester level: dùng để group theo năm/kỳ trên Roadmap
    semester_level: int = Field(
        default=1, ge=1, le=8, description="Học kỳ đề xuất (1-8)"
    )

    # Relationship: 1 Subject → nhiều StudentGrade
    grades: list["StudentGrade"] = Relationship(back_populates="subject")


class StudentGrade(SQLModel, table=True):
    """
    Bảng StudentGrade — Bảng điểm chi tiết.
    Liên kết Student ↔ Subject thông qua foreign keys.
    """

    __tablename__ = "student_grades"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Foreign key → Student
    student_id: int = Field(foreign_key="students.id", index=True)
    student: Optional[Student] = Relationship(back_populates="grades")

    # Foreign key → Subject (qua ma_mon)
    subject_code: str = Field(foreign_key="subjects.ma_mon", index=True, max_length=20)
    subject: Optional[Subject] = Relationship(back_populates="grades")

    # Điểm số
    diem_so: Optional[float] = Field(
        default=None, ge=0.0, le=10.0, description="Điểm số (thang 10)"
    )
    diem_chu: Optional[str] = Field(
        default=None, max_length=5, description="Điểm chữ (A, B+, C, ...)"
    )

    # Trạng thái
    trang_thai: GradeStatus = Field(
        default=GradeStatus.DANG_HOC, description="Trạng thái: DAT / ROT / DANG_HOC"
    )
