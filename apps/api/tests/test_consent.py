"""Integration tests: consent record + active check."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

import pytest

from app.core.legal import POLICY_VERSION, TOS_VERSION
from app.core.security.consent import (
    has_active_consent,
    record_consent,
    revoke_consent,
)
from app.db.models.core_security import Major, Student

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_active_consent_after_record(db_session) -> None:
    major = Major(code="CNTT", name="Computer Science")
    db_session.add(major)
    await db_session.flush()

    sid = uuid.uuid4()
    st = Student(
        id=sid,
        student_code_ciphertext="vault:stub",
        full_name_ciphertext="vault:stub",
        major_id=major.id,
        enrollment_year=2025,
    )
    db_session.add(st)
    await db_session.flush()

    await record_consent(
        db_session,
        student_id=sid,
        privacy_policy_version=POLICY_VERSION,
        tos_version=TOS_VERSION,
        consented_at=datetime.now(UTC),
        ip_address="127.0.0.1",
        user_agent="pytest",
    )
    await db_session.commit()

    ok = await has_active_consent(
        db_session,
        sid,
        expected_privacy_version=POLICY_VERSION,
        expected_tos_version=TOS_VERSION,
    )
    assert ok is True


@pytest.mark.asyncio
async def test_revoke_makes_consent_inactive(db_session) -> None:
    major = Major(code="KHMT", name="KHMT")
    db_session.add(major)
    await db_session.flush()

    sid = uuid.uuid4()
    st = Student(
        id=sid,
        student_code_ciphertext="vault:stub2",
        full_name_ciphertext="vault:stub2",
        major_id=major.id,
        enrollment_year=2025,
    )
    db_session.add(st)
    await db_session.flush()

    row = await record_consent(
        db_session,
        student_id=sid,
        privacy_policy_version=POLICY_VERSION,
        tos_version=TOS_VERSION,
        consented_at=datetime.now(UTC),
    )
    await db_session.commit()

    await revoke_consent(db_session, row.id, datetime.now(UTC))
    await db_session.commit()

    ok = await has_active_consent(
        db_session,
        sid,
        expected_privacy_version=POLICY_VERSION,
        expected_tos_version=TOS_VERSION,
    )
    assert ok is False


@pytest.mark.asyncio
async def test_version_mismatch_not_active(db_session) -> None:
    major = Major(code="MMT", name="MMT")
    db_session.add(major)
    await db_session.flush()

    sid = uuid.uuid4()
    st = Student(
        id=sid,
        student_code_ciphertext="vault:stub3",
        full_name_ciphertext="vault:stub3",
        major_id=major.id,
        enrollment_year=2025,
    )
    db_session.add(st)
    await db_session.flush()

    await record_consent(
        db_session,
        student_id=sid,
        privacy_policy_version="old",
        tos_version="old",
        consented_at=datetime.now(UTC),
    )
    await db_session.commit()

    ok = await has_active_consent(
        db_session,
        sid,
        expected_privacy_version=POLICY_VERSION,
        expected_tos_version=TOS_VERSION,
    )
    assert ok is False


@pytest.mark.asyncio
async def test_consent_guard_ok_requires_both_flags() -> None:
    from app.core.security.consent import consent_guard_ok

    assert consent_guard_ok(privacy_accepted=True, tos_accepted=True)
    assert not consent_guard_ok(privacy_accepted=False, tos_accepted=True)
    assert not consent_guard_ok(privacy_accepted=True, tos_accepted=False)
