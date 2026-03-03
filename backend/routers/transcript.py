"""
routers/transcript.py — API endpoints cho upload và xử lý transcript.
"""

import logging
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlmodel import Session

from core.database import get_session
from schemas.schemas import TranscriptUploadResponse, StudentResponse, GradeResponse
from services.parser import parse_transcript
from services.transcript_service import process_transcript

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["transcript"])


@router.post("/upload-transcript", response_model=TranscriptUploadResponse)
async def upload_transcript(
    file: UploadFile = File(..., description="File HTML bảng điểm"),
    session: Session = Depends(get_session),
) -> TranscriptUploadResponse:
    """
    Upload file HTML transcript và parse dữ liệu.

    Flow:
    1. Validate file (chỉ nhận HTML)
    2. Parse HTML → extract student info + grades
    3. Upsert vào database
    4. Trả về kết quả
    """
    # Validate file type
    if file.content_type and "html" not in file.content_type:
        # Cho phép cả text/html và application/octet-stream (khi browser không detect đúng)
        if file.filename and not file.filename.endswith(".html"):
            raise HTTPException(
                status_code=400,
                detail="Chỉ chấp nhận file HTML (.html). Vui lòng kiểm tra lại file.",
            )

    try:
        # Đọc nội dung file
        content = await file.read()
        html_content = content.decode("utf-8")

        # Parse transcript
        parsed = parse_transcript(html_content)

        # Process & save to DB
        student = process_transcript(session, parsed)

        # Build response
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

        student_response = StudentResponse(
            mssv=student.mssv,
            ho_ten=student.ho_ten,
            major=student.major,
            current_gpa=student.current_gpa,
            grades=grades_response,
        )

        return TranscriptUploadResponse(
            success=True,
            message=f"Upload thành công! Đã xử lý {len(grades_response)} môn học.",
            student=student_response,
            total_grades=len(grades_response),
        )

    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except UnicodeDecodeError:
        raise HTTPException(
            status_code=400,
            detail="Không thể đọc file. Đảm bảo file được encode UTF-8.",
        )
    except Exception as e:
        logger.exception("Lỗi xử lý transcript")
        raise HTTPException(
            status_code=500, detail=f"Lỗi server khi xử lý file: {str(e)}"
        )
