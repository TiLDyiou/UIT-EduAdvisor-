import asyncio
from app.db.session import get_sessionmaker
from sqlalchemy import select, delete
from app.db.models.academic import Schedule

async def main():
    maker = get_sessionmaker()
    async with maker() as db:
        await db.execute(delete(Schedule))
        await db.commit()

asyncio.run(main())
