import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, selectinload
from sqlalchemy import select
from app.db.models.core_security import Student
from app.core.config import get_settings
from app.services.moodle.client import moodle_get_calendar_events_json
import base64
import httpx

async def main():
    settings = get_settings()
    engine = create_async_engine("postgresql+asyncpg://eduadvisor:change-me-in-real-env@127.0.0.1:54321/eduadvisor")
    maker = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    ctx = base64.b64encode(b"student_code").decode("ascii")
    
    async with httpx.AsyncClient() as vault_client:
        async with maker() as session:
            res = await session.execute(select(Student).options(selectinload(Student.credentials)).limit(1))
            student = res.scalar_one_or_none()
            ct = student.student_code_ciphertext
            
            resp = await vault_client.post(
                "http://127.0.0.1:8200/v1/transit/decrypt/app-deterministic",
                headers={"X-Vault-Token": "dev-only-root-token"},
                json={"ciphertext": ct, "context": ctx}
            )
            mssv = base64.b64decode(resp.json()["data"]["plaintext"]).decode()
            
            pw_ct = student.credentials.password_ciphertext if student.credentials else None
            if not pw_ct:
                print("No password")
                return
            resp = await vault_client.post(
                "http://127.0.0.1:8200/v1/transit/decrypt/app-data",
                headers={"X-Vault-Token": "dev-only-root-token"},
                json={"ciphertext": pw_ct}
            )
            pw = base64.b64decode(resp.json()["data"]["plaintext"]).decode()
            
            data = await moodle_get_calendar_events_json(settings, username=mssv, password=pw)
            import json
            print(json.dumps(data, indent=2, ensure_ascii=False))

    await engine.dispose()

asyncio.run(main())
