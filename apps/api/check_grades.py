import asyncio
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.config import get_settings
from app.db.models.academic import Enrollment, Grade, Course
from app.db.session import close_engine, get_sessionmaker, init_engine

async def main():
    init_engine(get_settings().database_url)
    try:
        maker = get_sessionmaker()
        async with maker() as session:
            res = await session.execute(
                select(Enrollment)
                .options(selectinload(Enrollment.course), selectinload(Enrollment.grades))
            )
            enrollments = res.scalars().all()
            print(f"Total Enrollments: {len(enrollments)}")
            for e in enrollments:
                grades_str = ", ".join([f"{g.component}: {g.score}" for g in e.grades])
                print(f"Course: {e.course.code} ({e.course.name}), Term: {e.term_code}, Status: {e.status}, Final: {e.final_grade_10}, Grades: [{grades_str}]")
    finally:
        await close_engine()

if __name__ == "__main__":
    asyncio.run(main())
