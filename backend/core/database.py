"""
core/database.py — Database engine & session configuration.
Sử dụng SQLite cho MVP, dễ migrate sang PostgreSQL sau.
"""

from sqlmodel import SQLModel, Session, create_engine

# --- Database URL ---
# MVP: SQLite. Đổi sang PostgreSQL khi cần pgvector.
# PostgreSQL example: "postgresql://user:pass@localhost:5432/uit_eduadvisor"
DATABASE_URL = "sqlite:///./uit_eduadvisor.db"

# SQLite cần connect_args cho multi-thread support
engine = create_engine(
    DATABASE_URL,
    echo=True,  # Log SQL queries (tắt khi production)
    connect_args={"check_same_thread": False},  # Chỉ cần cho SQLite
)


def create_db_and_tables() -> None:
    """Tạo tất cả tables từ SQLModel metadata."""
    SQLModel.metadata.create_all(engine)


def get_session():
    """Dependency injection: tạo DB session cho mỗi request."""
    with Session(engine) as session:
        yield session
