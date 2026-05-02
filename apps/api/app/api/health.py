"""Health and readiness probes.

- `/healthz`: liveness. Returns 200 if the process is up. No I/O.
- `/readyz`:  readiness. Returns 200 only if every external dependency
  (Postgres, Redis, Vault) responds. Used by docker-compose healthcheck
  and, later, by a load balancer.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Literal

from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.db.session import get_engine

logger = logging.getLogger(__name__)
router = APIRouter(tags=["health"])

CheckStatus = Literal["ok", "fail"]
_PROBE_TIMEOUT_SECONDS = 2.0


@router.get("/healthz")
async def healthz() -> dict[str, str]:
    return {"status": "ok"}


async def _check_postgres() -> tuple[CheckStatus, str | None]:
    try:
        engine = get_engine()
        async with engine.connect() as conn:
            await asyncio.wait_for(conn.execute(text("SELECT 1")), timeout=_PROBE_TIMEOUT_SECONDS)
        return "ok", None
    except Exception as exc:
        logger.warning("postgres probe failed: %s", exc)
        return "fail", str(exc)


async def _check_redis(request: Request) -> tuple[CheckStatus, str | None]:
    try:
        client = request.app.state.redis
        await asyncio.wait_for(client.ping(), timeout=_PROBE_TIMEOUT_SECONDS)
        return "ok", None
    except Exception as exc:
        logger.warning("redis probe failed: %s", exc)
        return "fail", str(exc)


async def _check_vault(request: Request) -> tuple[CheckStatus, str | None]:
    """hvac is sync; offload to a thread to keep the probe non-blocking."""
    try:
        client = request.app.state.vault
        is_initialized = await asyncio.wait_for(
            asyncio.to_thread(lambda: client.sys.is_initialized()),
            timeout=_PROBE_TIMEOUT_SECONDS,
        )
        if not is_initialized:
            return "fail", "vault not initialized"
        return "ok", None
    except Exception as exc:
        logger.warning("vault probe failed: %s", exc)
        return "fail", str(exc)


@router.get("/readyz")
async def readyz(request: Request) -> JSONResponse:
    pg_status, pg_err = await _check_postgres()
    redis_status, redis_err = await _check_redis(request)
    vault_status, vault_err = await _check_vault(request)

    checks: dict[str, Any] = {
        "postgres": {"status": pg_status, "error": pg_err},
        "redis": {"status": redis_status, "error": redis_err},
        "vault": {"status": vault_status, "error": vault_err},
    }
    overall_ok = all(c["status"] == "ok" for c in checks.values())
    code = status.HTTP_200_OK if overall_ok else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(
        status_code=code,
        content={"status": "ok" if overall_ok else "fail", "checks": checks},
    )
