"""App lifespan: own the DB engine and shared clients (Redis, Vault).

Built as an `asynccontextmanager` so resources are released cleanly even
when uvicorn shuts down on SIGTERM.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import TYPE_CHECKING

import hvac
import redis.asyncio as redis_async

from app.core.config import get_settings
from app.core.security.vault_transit import VaultTransit
from app.db.session import close_engine, init_engine

if TYPE_CHECKING:
    from fastapi import FastAPI

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    logger.info("startup: initializing resources", extra={"app_env": settings.app_env})

    init_engine(settings.database_url)
    redis_client = redis_async.from_url(settings.redis_url, decode_responses=True)
    vault_client = hvac.Client(url=settings.vault_addr, token=settings.vault_dev_root_token_id)

    vault_transit = VaultTransit(vault_client)
    await vault_transit.bootstrap()

    app.state.redis = redis_client
    app.state.vault = vault_client
    app.state.vault_transit = vault_transit

    try:
        yield
    finally:
        logger.info("shutdown: closing resources")
        await redis_client.close()
        await close_engine()
