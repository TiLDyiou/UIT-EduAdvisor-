import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.db.models.academic import Deadline

async def main():
    engine = create_async_engine("postgresql+asyncpg://eduadvisor:change-me-in-real-env@127.0.0.1:54321/eduadvisor")
    maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        res = await session.execute(select(Deadline))
        deadlines = res.scalars().all()
        for d in deadlines:
            if "Web" in d.title or "Đồ Án" in d.title or "NT208" in d.title:
                print(f"FOUND: Title: {d.title}, Due: {d.due_at}, Completed: {d.completed_at}")
    await engine.dispose()

asyncio.run(main())
