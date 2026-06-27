import asyncio
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.db.models.core_security import Student
import base64

async def main():
    engine = create_async_engine("postgresql+asyncpg://eduadvisor:change-me-in-real-env@127.0.0.1:54321/eduadvisor")
    maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with httpx.AsyncClient() as client:
        async with maker() as session:
            res = await session.execute(select(Student).where(Student.id == 'd53edf83-1576-452e-a8ad-8593e97efd72'))
            s = res.scalar_one_or_none()
            ct = s.student_code_ciphertext
            
            resp = await client.post(
                "http://127.0.0.1:8200/v1/transit/decrypt/app-data",
                headers={"X-Vault-Token": "dev-only-root-token"},
                json={"ciphertext": ct}
            )
            if resp.status_code == 200:
                pt = base64.b64decode(resp.json()["data"]["plaintext"]).decode()
                print(f"Student {s.id} MSSV is: {pt}")
            else:
                print(f"Student {s.id} error: {resp.text}")
                    
    await engine.dispose()

asyncio.run(main())
