"""Admin password hashing with bcrypt."""

from __future__ import annotations

import bcrypt

_ROUNDS = 12


def hash_password(plain: str) -> str:
    salt = bcrypt.gensalt(rounds=_ROUNDS)
    return bcrypt.hashpw(plain.encode("utf-8"), salt).decode("ascii")


def verify_password(plain: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), password_hash.encode("ascii"))
    except ValueError:
        return False
