import sys
import asyncio

sys.path.insert(0, '/home/tildy/Documents/UIT-EduAdvisor-/apps/api')
from app.db.session import AsyncSessionLocal
from app.api.v1.scheduler import recommend
from app.models.student import Student

async def main():
    db = AsyncSessionLocal()
    # Dummy student for testing
    student = Student(id="test_uid", student_code="12345", major_id=1, status="ACTIVE", current_semester="20251")
    codes = ["IT001", "IT002"] # Just a small sample
    try:
        res = await recommend(db=db, student=student, available_course_codes=codes)
        print("Success:", len(res.recommendations))
    except Exception as e:
        import traceback
        traceback.print_exc()
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(main())
