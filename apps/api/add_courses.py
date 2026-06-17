import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.db.models.academic import Course
from sqlalchemy import select

async def main():
    database_url = "postgresql+asyncpg://eduadvisor:change-me-in-real-env@localhost:54321/eduadvisor"
    engine = create_async_engine(database_url)
    SessionMaker = async_sessionmaker(engine, expire_on_commit=False)
    
    courses_to_add = [
        {"code": "CN1", "name": "Môn chuyên ngành 1", "credits": 3, "kind": "chuyên ngành", "difficulty": "Cao"},
        {"code": "CN2", "name": "Môn chuyên ngành 2", "credits": 3, "kind": "chuyên ngành", "difficulty": "Cao"},
        {"code": "CN3", "name": "Môn chuyên ngành 3", "credits": 3, "kind": "chuyên ngành", "difficulty": "Cao"}
    ]
    
    async with SessionMaker() as session:
        for c_data in courses_to_add:
            # Check if exists
            stmt = select(Course).where(Course.name == c_data["name"])
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            if not existing:
                course = Course(**c_data)
                session.add(course)
                print(f"Added: {c_data['name']}")
            else:
                print(f"Already exists: {c_data['name']}")
        await session.commit()
    print("All done")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
