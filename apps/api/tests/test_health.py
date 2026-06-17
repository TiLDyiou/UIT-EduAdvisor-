"""Smoke test: liveness probe must return 200 without external deps.

`/readyz` is NOT tested here because it requires a real Postgres, Redis,
and Vault. Integration tests with testcontainers come in M1.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.health import router


def test_healthz_returns_ok() -> None:
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        resp = client.get("/healthz")

    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
