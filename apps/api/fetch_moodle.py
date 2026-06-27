import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.db.models.core_security import Student
from app.core.config import get_settings
from app.services.moodle.client import moodle_get_assignments_json
from app.services.vault.transit import decrypt_data

async def main():
    settings = get_settings()
    engine = create_async_engine("postgresql+asyncpg://eduadvisor:change-me-in-real-env@127.0.0.1:54321/eduadvisor")
    maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with maker() as session:
        # Get the first student
        res = await session.execute(select(Student).limit(1))
        student = res.scalar_one_or_none()
        
        if not student:
            print("No student found")
            return
            
        # Decrypt credentials
        student_code = await decrypt_data(settings, student.student_code_ciphertext)
        
        # We don't have the vault token easily here, but we can bypass or use the proper vault service
        # Let's just import the sync job logic
        pass
        
    await engine.dispose()

asyncio.run(main())
