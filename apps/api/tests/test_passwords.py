"""Unit tests: bcrypt admin passwords."""

from __future__ import annotations

from app.core.security.passwords import hash_password, verify_password


def test_hash_and_verify_round_trip() -> None:
    h = hash_password("correct horse battery staple")
    assert verify_password("correct horse battery staple", h)
    assert not verify_password("wrong", h)


def test_verify_rejects_malformed_hash() -> None:
    assert not verify_password("x", "not-a-valid-bcrypt-string")
