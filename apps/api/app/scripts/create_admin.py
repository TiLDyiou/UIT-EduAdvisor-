"""Tạo hoặc reset password admin (single-admin model M4).

Chạy:
    python -m app.scripts.create_admin

Email và password đều prompt qua CLI; password dùng getpass để không vào shell history.
Nếu email đã tồn tại, script sẽ rotate password thay vì tạo mới
(an toàn hơn trong recovery: ta không lỡ tay tạo nhiều admin trùng email).
"""

from __future__ import annotations

import asyncio
import getpass
import sys
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.config import get_settings
from app.core.security.passwords import hash_password
from app.db.models.core_security import AdminUser
from app.db.session import close_engine, get_sessionmaker, init_engine


def _prompt_email() -> str:
    email = input("Admin email: ").strip().lower()
    if not email or "@" not in email or len(email) > 256:
        print("Email không hợp lệ.", file=sys.stderr)
        sys.exit(2)
    return email


def _prompt_password() -> str:
    pw1 = getpass.getpass("Admin password: ")
    pw2 = getpass.getpass("Nhập lại password: ")
    if pw1 != pw2:
        print("Password không khớp.", file=sys.stderr)
        sys.exit(2)
    if len(pw1) < 12:
        print("Password phải >= 12 ký tự.", file=sys.stderr)
        sys.exit(2)
    return pw1


async def _upsert_admin(email: str, password: str) -> str:
    """Return action taken: 'created' or 'password_rotated'."""
    init_engine(get_settings().database_url)
    try:
        maker = get_sessionmaker()
        async with maker() as session:
            res = await session.execute(
                select(AdminUser).where(AdminUser.email == email).limit(1)
            )
            existing = res.scalar_one_or_none()
            pw_hash = hash_password(password)
            if existing is None:
                session.add(AdminUser(email=email, password_hash=pw_hash))
                await session.commit()
                return "created"
            existing.password_hash = pw_hash
            existing.last_login_at = None
            existing.created_at = existing.created_at or datetime.now(UTC)
            await session.commit()
            return "password_rotated"
    finally:
        await close_engine()


def main() -> None:
    email = _prompt_email()
    password = _prompt_password()
    action = asyncio.run(_upsert_admin(email, password))
    print(f"OK: admin {email} ({action}).")


if __name__ == "__main__":
    main()
