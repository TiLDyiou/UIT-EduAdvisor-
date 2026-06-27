import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import delete
from app.db.models.core_security import Student
import uuid

async def main():
    engine = create_async_engine("postgresql+asyncpg://eduadvisor:change-me-in-real-env@127.0.0.1:54321/eduadvisor")
    maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    old_id = uuid.UUID("d53edf83-1576-452e-a8ad-8593e97efd72")
    
    async with maker() as session:
        # Delete student
        await session.execute(delete(Student).where(Student.id == old_id))
        await session.commit()
        print("Deleted old student.")
                    
    await engine.dispose()

asyncio.run(main())
