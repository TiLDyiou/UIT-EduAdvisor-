"""
services/transcript_service.py — Business logic xử lý transcript.

Orchestrate: parse HTML → upsert Student → upsert Grades → tính GPA.
"""

import logging
from sqlmodel import Session, select

from models.models import Student, Subject, StudentGrade, GradeStatus
from schemas.schemas import ParsedTranscript, ParsedGrade

logger = logging.getLogger(__name__)


def _determine_grade_status(diem_so: float | None) -> GradeStatus:
    """
    Xác định trạng thái môn học dựa trên điểm số.

    Quy tắc UIT:
    - >= 5.0: Đạt
    - < 5.0: Rớt
    - None: Đang học (chưa có điểm)
    """
    if diem_so is None:
        return GradeStatus.DANG_HOC
    return GradeStatus.DAT if diem_so >= 5.0 else GradeStatus.ROT


def _calculate_gpa(grades: list[StudentGrade], session: Session) -> float | None:
    """
    Tính GPA trung bình có trọng số (theo tín chỉ).

    Formula: GPA = Σ(điểm × tín_chỉ) / Σ(tín_chỉ)
    Chỉ tính các môn đã có điểm (không tính DANG_HOC).
    """
    total_weighted = 0.0
    total_credits = 0

    for grade in grades:
        if grade.diem_so is None:
            continue

        # Lấy số tín chỉ từ Subject table
        subject = session.exec(
            select(Subject).where(Subject.ma_mon == grade.subject_code)
        ).first()

        credits = subject.so_tin_chi if subject else 3  # Default 3 TC
        total_weighted += grade.diem_so * credits
        total_credits += credits

    if total_credits == 0:
        return None

    return round(total_weighted / total_credits, 2)


def _upsert_student(session: Session, parsed: ParsedTranscript) -> Student:
    """
    Upsert Student record.
    - Nếu MSSV đã tồn tại → cập nhật thông tin
    - Nếu chưa → tạo mới
    """
    existing = session.exec(select(Student).where(Student.mssv == parsed.mssv)).first()

    if existing:
        logger.info(f"Cập nhật sinh viên: {parsed.mssv}")
        existing.ho_ten = parsed.ho_ten
        if parsed.major:
            existing.major = parsed.major
        session.add(existing)
        return existing
    else:
        logger.info(f"Tạo sinh viên mới: {parsed.mssv}")
        student = Student(
            mssv=parsed.mssv,
            ho_ten=parsed.ho_ten,
            major=parsed.major,
        )
        session.add(student)
        session.flush()  # Để có student.id
        return student


def _upsert_grades(
    session: Session,
    student: Student,
    parsed_grades: list[ParsedGrade],
) -> list[StudentGrade]:
    """
    Upsert grades cho student.
    - Nếu grade đã tồn tại (student_id + subject_code) → cập nhật điểm
    - Nếu chưa → tạo mới

    Đồng thời auto-create Subject nếu chưa tồn tại trong danh mục.
    """
    result_grades: list[StudentGrade] = []

    for pg in parsed_grades:
        # Auto-create Subject nếu chưa có
        subject = session.exec(
            select(Subject).where(Subject.ma_mon == pg.ma_mon)
        ).first()

        if not subject:
            subject = Subject(
                ma_mon=pg.ma_mon,
                ten_mon=pg.ten_mon,
                so_tin_chi=pg.so_tin_chi or 3,
            )
            session.add(subject)
            session.flush()

        # Upsert Grade
        status = _determine_grade_status(pg.diem_so)

        existing_grade = session.exec(
            select(StudentGrade).where(
                StudentGrade.student_id == student.id,
                StudentGrade.subject_code == pg.ma_mon,
            )
        ).first()

        if existing_grade:
            existing_grade.diem_so = pg.diem_so
            existing_grade.diem_chu = pg.diem_chu
            existing_grade.trang_thai = status
            session.add(existing_grade)
            result_grades.append(existing_grade)
        else:
            grade = StudentGrade(
                student_id=student.id,
                subject_code=pg.ma_mon,
                diem_so=pg.diem_so,
                diem_chu=pg.diem_chu,
                trang_thai=status,
            )
            session.add(grade)
            result_grades.append(grade)

    return result_grades


def process_transcript(session: Session, parsed: ParsedTranscript) -> Student:
    """
    Xử lý transcript đã parse: upsert student, upsert grades, tính GPA.

    Đây là hàm chính được gọi từ router.
    Toàn bộ operations nằm trong cùng 1 session/transaction.

    Args:
        session: SQLModel database session
        parsed: ParsedTranscript từ parser

    Returns:
        Student object đã cập nhật (bao gồm grades relationship)
    """
    # Step 1: Upsert Student
    student = _upsert_student(session, parsed)

    # Step 2: Upsert Grades
    grades = _upsert_grades(session, student, parsed.grades)

    # Step 3: Tính GPA
    session.flush()
    student.current_gpa = _calculate_gpa(grades, session)
    session.add(student)

    # Commit transaction
    session.commit()
    session.refresh(student)

    logger.info(
        f"Xử lý xong transcript: {student.mssv} — "
        f"{len(grades)} môn, GPA: {student.current_gpa}"
    )

    return student
