"""Import ATTT K19 curriculum with correct term assignments.

Based on the CSV file attt_k19.csv, the term assignments (from the bottom section) are:

Term 1: IT001, MA006, MA003, PH002, NT015, ENG01
Term 2: IT002, IT005, MA004, IT006, SS006, ENG02
Term 3: IT004, NT209, IT003, SS004, MA005, ENG03
Term 4: IT007, NT106, NT219, NT208, SS010, SS007
Term 5: SS008, SS009, NT132, NT140, NT521 + 1 chuyên ngành tự chọn
Term 6: NT230, SS003, NT114, + 2 chuyên ngành tự chọn + 1 tự chọn tự do
Term 7: NT215, NT505/NT506/NT508 (tốt nghiệp) + 1 tự chọn tự do
"""

import asyncio

from sqlalchemy import select

from app.core.config import get_settings
from app.db.models.academic import (
    Course,
    Curriculum,
    CurriculumCourse,
    CurriculumTerm,
)
from app.db.models.core_security import Major
from app.db.session import close_engine, get_sessionmaker, init_engine

# Correct term assignments parsed manually from CSV
TERM_COURSES = {
    1: [
        ("IT001", True),
        ("MA006", True),
        ("MA003", True),
        ("PH002", True),
        ("NT015", True),
        ("ENG01", True),
    ],
    2: [
        ("IT002", True),
        ("IT005", True),
        ("MA004", True),
        ("IT006", True),
        ("SS006", True),
        ("ENG02", True),
    ],
    3: [
        ("IT004", True),
        ("NT209", True),
        ("IT003", True),
        ("SS004", True),
        ("MA005", True),
        ("ENG03", True),
    ],
    4: [
        ("IT007", True),
        ("NT106", True),
        ("NT219", True),
        ("NT208", True),
        ("SS010", True),
        ("SS007", True),
    ],
    5: [
        ("SS008", True),
        ("SS009", True),
        ("NT132", True),
        ("NT140", True),
        ("NT521", True),
    ],
    6: [
        ("NT230", True),
        ("SS003", True),
        ("NT114", True),
    ],
    7: [
        ("NT215", True),
        ("NT505", False),
        ("NT506", False),
        ("NT508", False),
    ],
}


async def main():
    init_engine(get_settings().database_url)
    try:
        maker = get_sessionmaker()
        async with maker() as session:
            # Find major
            res = await session.execute(select(Major).where(Major.code == "7480202").limit(1))
            major = res.scalar_one_or_none()
            if major is None:
                print("ERROR: Major 7480202 not found")
                return
            print(f"Major: {major.name} (id={major.id})")

            # Create curriculum
            curriculum = Curriculum(
                major_id=major.id,
                name="CTDT An toàn thông tin K19",
                effective_year=2023,
                total_credits=130,
            )
            session.add(curriculum)
            await session.flush()
            print(f"Created curriculum id={curriculum.id}")

            # Create terms and assign courses
            for term_num, courses in sorted(TERM_COURSES.items()):
                term = CurriculumTerm(
                    curriculum_id=curriculum.id,
                    term_number=term_num,
                )
                session.add(term)
                await session.flush()

                assigned = 0
                for code, is_required in courses:
                    res = await session.execute(select(Course).where(Course.code == code).limit(1))
                    course = res.scalar_one_or_none()
                    if course is None:
                        print(f"  WARNING: course {code} not found, skipping")
                        continue
                    session.add(
                        CurriculumCourse(
                            curriculum_term_id=term.id,
                            course_id=course.id,
                            is_required=is_required,
                        )
                    )
                    assigned += 1

                print(f"  Term {term_num}: {assigned} courses assigned")

            await session.commit()
            print("\n✅ Curriculum created successfully!")

    finally:
        await close_engine()


if __name__ == "__main__":
    asyncio.run(main())
