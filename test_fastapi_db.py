import sys
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, '/home/tildy/Documents/UIT-EduAdvisor-/apps/api')
from app.db.session import engine, AsyncSessionLocal
from app.api.v1.scheduler import recommend
from app.models.student import Student

async def main():
    async with AsyncSessionLocal() as db:
        student = Student(id="test_uid", student_code="12345", major_id=1, status="ACTIVE", current_semester="20251")
        try:
            res = await recommend(db=db, student=student, available_course_codes=["IT001", "IT002"])
            print("Success:", len(res.recommendations))
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
