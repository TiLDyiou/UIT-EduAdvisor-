import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.db.models.core_security import SyncJob

async def main():
    engine = create_async_engine("postgresql+asyncpg://eduadvisor:change-me-in-real-env@127.0.0.1:54321/eduadvisor")
    maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        res = await session.execute(select(SyncJob).order_by(SyncJob.created_at.desc()).limit(1))
        job = res.scalar_one_or_none()
        if job:
            print(f"Status: {job.status}")
            print(f"Result summary: {job.result_summary}")
        else:
            print("NO JOBS")
    await engine.dispose()

asyncio.run(main())
