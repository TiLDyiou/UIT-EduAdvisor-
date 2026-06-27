import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.db.models.core_security import Student

async def main():
    engine = create_async_engine("postgresql+asyncpg://eduadvisor:change-me-in-real-env@127.0.0.1:54321/eduadvisor")
    maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with maker() as session:
        res = await session.execute(select(Student))
        students = res.scalars().all()
        for s in students:
            print(f"Student ID: {s.id}, MSSV: {s.student_code_ciphertext}")
                
    await engine.dispose()

asyncio.run(main())
