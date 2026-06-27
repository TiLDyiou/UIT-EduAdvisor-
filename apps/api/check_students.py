import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.db.models.core_security import Student
from app.db.models.academic import Deadline
from app.db.models.bot import BotAccount

async def main():
    engine = create_async_engine("postgresql+asyncpg://eduadvisor:change-me-in-real-env@127.0.0.1:54321/eduadvisor")
    maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        res = await session.execute(select(Student))
        students = res.scalars().all()
        for s in students:
            print(f"Student: {s.id}")
            
        res = await session.execute(select(BotAccount))
        bots = res.scalars().all()
        for b in bots:
            print(f"BotAccount: {b.student_id}, platform: {b.platform}, user_id: {b.platform_user_id}")
            
        res = await session.execute(select(Deadline.student_id).distinct())
        ds = res.scalars().all()
        for d in ds:
            print(f"Deadline belongs to: {d}")
    await engine.dispose()

asyncio.run(main())
