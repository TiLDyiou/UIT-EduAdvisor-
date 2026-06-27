import asyncio
from app.db.session import init_engine, get_sessionmaker
from app.db.models.academic import Deadline
from sqlalchemy import select
from app.core.config import get_settings

async def main():
    settings = get_settings()
    init_engine(settings.database_url)
    maker = get_sessionmaker()
    async with maker() as session:
        res = await session.execute(select(Deadline))
        deadlines = res.scalars().all()
        for d in deadlines:
            print(f"Title: {d.title}, Due: {d.due_at}")

asyncio.run(main())
