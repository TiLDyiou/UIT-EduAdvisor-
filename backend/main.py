"""
UIT EduAdvisor — Backend API Server.

FastAPI application chính: đăng ký routers, CORS, startup events.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from core.database import create_db_and_tables, engine
from models.models import Subject

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# =============================================================================
# SEED DATA — Môn học mẫu chương trình CNTT (UIT)
# =============================================================================

SAMPLE_SUBJECTS = [
    # Năm 1 - Kỳ 1
    Subject(
        ma_mon="IT001",
        ten_mon="Nhập môn lập trình",
        so_tin_chi=4,
        semester_level=1,
        prerequisites=None,
    ),
    Subject(
        ma_mon="IT002",
        ten_mon="Cơ sở dữ liệu",
        so_tin_chi=4,
        semester_level=1,
        prerequisites=None,
    ),
    Subject(
        ma_mon="IT003",
        ten_mon="Toán rời rạc",
        so_tin_chi=4,
        semester_level=1,
        prerequisites=None,
    ),
    Subject(
        ma_mon="MA001",
        ten_mon="Giải tích 1",
        so_tin_chi=4,
        semester_level=1,
        prerequisites=None,
    ),
    # Năm 1 - Kỳ 2
    Subject(
        ma_mon="IT004",
        ten_mon="Cấu trúc dữ liệu và giải thuật",
        so_tin_chi=4,
        semester_level=2,
        prerequisites=["IT001"],
    ),
    Subject(
        ma_mon="IT005",
        ten_mon="Kiến trúc máy tính",
        so_tin_chi=3,
        semester_level=2,
        prerequisites=None,
    ),
    Subject(
        ma_mon="IT006",
        ten_mon="Mạng máy tính",
        so_tin_chi=4,
        semester_level=2,
        prerequisites=None,
    ),
    Subject(
        ma_mon="MA002",
        ten_mon="Giải tích 2",
        so_tin_chi=4,
        semester_level=2,
        prerequisites=["MA001"],
    ),
    # Năm 2 - Kỳ 3
    Subject(
        ma_mon="IT007",
        ten_mon="Hệ điều hành",
        so_tin_chi=4,
        semester_level=3,
        prerequisites=["IT004", "IT005"],
    ),
    Subject(
        ma_mon="SE001",
        ten_mon="Nhập môn Công nghệ phần mềm",
        so_tin_chi=4,
        semester_level=3,
        prerequisites=["IT004"],
    ),
    Subject(
        ma_mon="IT008",
        ten_mon="Lập trình hướng đối tượng",
        so_tin_chi=4,
        semester_level=3,
        prerequisites=["IT001"],
    ),
    Subject(
        ma_mon="MA003",
        ten_mon="Xác suất thống kê",
        so_tin_chi=3,
        semester_level=3,
        prerequisites=["MA001"],
    ),
    # Năm 2 - Kỳ 4
    Subject(
        ma_mon="SE002",
        ten_mon="Phát triển ứng dụng Web",
        so_tin_chi=4,
        semester_level=4,
        prerequisites=["IT004", "IT002"],
    ),
    Subject(
        ma_mon="SE003",
        ten_mon="Kiểm thử phần mềm",
        so_tin_chi=3,
        semester_level=4,
        prerequisites=["SE001"],
    ),
    Subject(
        ma_mon="IT009",
        ten_mon="Trí tuệ nhân tạo",
        so_tin_chi=4,
        semester_level=4,
        prerequisites=["IT004", "MA003"],
    ),
    Subject(
        ma_mon="IT010",
        ten_mon="Phân tích thiết kế hệ thống",
        so_tin_chi=4,
        semester_level=4,
        prerequisites=["SE001", "IT002"],
    ),
    # Năm 3 - Kỳ 5
    Subject(
        ma_mon="SE004",
        ten_mon="Phát triển ứng dụng di động",
        so_tin_chi=4,
        semester_level=5,
        prerequisites=["IT008", "SE002"],
    ),
    Subject(
        ma_mon="IT011",
        ten_mon="Học máy",
        so_tin_chi=4,
        semester_level=5,
        prerequisites=["IT009", "MA003"],
    ),
    Subject(
        ma_mon="SE005",
        ten_mon="DevOps và CI/CD",
        so_tin_chi=3,
        semester_level=5,
        prerequisites=["SE002"],
    ),
    Subject(
        ma_mon="IT012",
        ten_mon="An toàn thông tin",
        so_tin_chi=3,
        semester_level=5,
        prerequisites=["IT006", "IT007"],
    ),
    # Năm 3 - Kỳ 6
    Subject(
        ma_mon="SE006",
        ten_mon="Đồ án 1",
        so_tin_chi=3,
        semester_level=6,
        prerequisites=["SE002", "SE003"],
    ),
    Subject(
        ma_mon="IT013",
        ten_mon="Xử lý ngôn ngữ tự nhiên",
        so_tin_chi=3,
        semester_level=6,
        prerequisites=["IT011"],
    ),
    Subject(
        ma_mon="SE007",
        ten_mon="Quản lý dự án phần mềm",
        so_tin_chi=3,
        semester_level=6,
        prerequisites=["SE001"],
    ),
    # Năm 4 - Kỳ 7-8
    Subject(
        ma_mon="SE008",
        ten_mon="Đồ án 2",
        so_tin_chi=3,
        semester_level=7,
        prerequisites=["SE006"],
    ),
    Subject(
        ma_mon="SE009",
        ten_mon="Khóa luận tốt nghiệp",
        so_tin_chi=10,
        semester_level=8,
        prerequisites=["SE008"],
    ),
]


def seed_subjects() -> None:
    """Seed môn học mẫu nếu table rỗng."""
    with Session(engine) as session:
        existing = session.exec(select(Subject)).first()
        if existing:
            logger.info("Subjects đã có dữ liệu, skip seed.")
            return

        for subject in SAMPLE_SUBJECTS:
            session.add(subject)

        session.commit()
        logger.info(f"Đã seed {len(SAMPLE_SUBJECTS)} môn học mẫu.")


# =============================================================================
# APP LIFECYCLE
# =============================================================================


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup & shutdown events."""
    logger.info("🚀 UIT EduAdvisor API đang khởi động...")
    create_db_and_tables()
    seed_subjects()
    logger.info("✅ Database ready!")
    yield
    logger.info("👋 UIT EduAdvisor API đã tắt.")


# =============================================================================
# APP INSTANCE
# =============================================================================

app = FastAPI(
    title="UIT EduAdvisor API",
    description="API hỗ trợ học vụ cho sinh viên trường ĐH CNTT (UIT)",
    version="0.1.0 (MVP)",
    lifespan=lifespan,
)

# CORS — cho phép frontend Next.js (và Vercel) truy cập
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Cho phép tất cả origin (, Vercel, Localtunnel, v.v)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# REGISTER ROUTERS
# =============================================================================

from routers.transcript import router as transcript_router
from routers.subjects import router as subjects_router

app.include_router(transcript_router)
app.include_router(subjects_router)


@app.get("/")
def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "app": "UIT EduAdvisor",
        "version": "0.1.0-mvp",
    }
