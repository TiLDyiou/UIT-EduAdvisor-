"""Vault Transit encrypt/decrypt with separate keys for data vs deterministic lookup."""

from __future__ import annotations

import asyncio
import base64

import hvac

TRANSIT_MOUNT = "transit"


class VaultTransit:
    """Thin async wrapper around hvac Transit (sync API wrapped in threads)."""

    DATA_KEY = "app-data"
    DETERMINISTIC_KEY = "app-deterministic"
    DETERMINISTIC_CONTEXT = b"student_code"

    def __init__(self, client: hvac.Client) -> None:
        self._client = client

    async def bootstrap(self) -> None:
        """Enable Transit mount and create keys if missing (idempotent)."""
        await asyncio.to_thread(self._ensure_transit_mount)
        await asyncio.to_thread(
            self._ensure_key, self.DATA_KEY, convergent_encryption=False, derived=False
        )
        await asyncio.to_thread(
            self._ensure_key,
            self.DETERMINISTIC_KEY,
            convergent_encryption=True,
            derived=True,
        )

    def _ensure_transit_mount(self) -> None:
        try:
            self._client.sys.enable_secrets_engine(backend_type="transit", path=TRANSIT_MOUNT)
        except hvac.exceptions.InvalidRequest as exc:
            err = str(exc).lower()
            if "path is already in use" in err or "already in use" in err:
                return
            raise

    def _ensure_key(
        self,
        name: str,
        *,
        convergent_encryption: bool,
        derived: bool,
    ) -> None:
        try:
            self._client.secrets.transit.read_key(name=name)
            return
        except hvac.exceptions.InvalidPath:
            pass
        opts: dict[str, bool] = {"derived": derived, "convergent_encryption": convergent_encryption}
        self._client.secrets.transit.create_key(name=name, **opts)

    async def encrypt(self, plaintext: bytes) -> str:
        b64 = base64.b64encode(plaintext).decode("ascii")

        def _run() -> str:
            r = self._client.secrets.transit.encrypt_data(name=self.DATA_KEY, plaintext=b64)
            return str(r["data"]["ciphertext"])

        return await asyncio.to_thread(_run)

    async def decrypt(self, ciphertext: str) -> bytes:
        def _run() -> bytes:
            r = self._client.secrets.transit.decrypt_data(name=self.DATA_KEY, ciphertext=ciphertext)
            raw = r["data"]["plaintext"]
            return base64.b64decode(raw)

        return await asyncio.to_thread(_run)

    async def encrypt_deterministic(self, plaintext: bytes) -> str:
        b64_pt = base64.b64encode(plaintext).decode("ascii")
        ctx = base64.b64encode(self.DETERMINISTIC_CONTEXT).decode("ascii")

        def _run() -> str:
            r = self._client.secrets.transit.encrypt_data(
                name=self.DETERMINISTIC_KEY,
                plaintext=b64_pt,
                context=ctx,
            )
            return str(r["data"]["ciphertext"])

        return await asyncio.to_thread(_run)

    async def decrypt_deterministic(self, ciphertext: str) -> bytes:
        ctx = base64.b64encode(self.DETERMINISTIC_CONTEXT).decode("ascii")

        def _run() -> bytes:
            r = self._client.secrets.transit.decrypt_data(
                name=self.DETERMINISTIC_KEY,
                ciphertext=ciphertext,
                context=ctx,
            )
            raw = r["data"]["plaintext"]
            return base64.b64decode(raw)

        return await asyncio.to_thread(_run)
