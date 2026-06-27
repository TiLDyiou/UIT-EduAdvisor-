"""Integration tests: Vault Transit encrypt/decrypt paths."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_encrypt_decrypt_round_trip(vault_transit) -> None:
    pt = b"super-secret-password-bytes"
    ct = await vault_transit.encrypt(pt)
    assert ct.startswith("vault:v")
    out = await vault_transit.decrypt(ct)
    assert out == pt


@pytest.mark.asyncio
async def test_deterministic_encrypt_stable(vault_transit) -> None:
    pt = b"25730123"
    a = await vault_transit.encrypt_deterministic(pt)
    b = await vault_transit.encrypt_deterministic(pt)
    assert a == b
    assert await vault_transit.decrypt_deterministic(a) == pt


@pytest.mark.asyncio
async def test_deterministic_differs_for_different_plaintext(vault_transit) -> None:
    a = await vault_transit.encrypt_deterministic(b"A")
    b = await vault_transit.encrypt_deterministic(b"B")
    assert a != b


@pytest.mark.asyncio
async def test_decrypt_wrong_key_fails(vault_transit) -> None:
    import hvac

    pt = b"x"
    ct_data = await vault_transit.encrypt(pt)
    with pytest.raises(hvac.exceptions.VaultError):
        await vault_transit.decrypt_deterministic(ct_data)
