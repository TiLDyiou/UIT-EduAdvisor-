import asyncio
from sqlalchemy import select
from app.db.models.core_security import Major
from app.db.session import get_sessionmaker, init_engine
from app.core.config import get_settings

async def main():
    init_engine(get_settings().database_url)
    maker = get_sessionmaker()
    async with maker() as session:
        res = await session.execute(select(Major))
        majors = res.scalars().all()
        for m in majors:
            print(f"{m.id}: {m.code} - {m.name}")

if __name__ == "__main__":
    asyncio.run(main())
