"""FastAPI entrypoint."""

from __future__ import annotations

import logging
import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.core.config import get_settings
from app.core.lifecycle import lifespan
from app.core.logging import configure_logging, new_request_id, set_request_id

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.app_log_level)

    app = FastAPI(
        title="UIT EduAdvisor API",
        version="0.1.0",
        docs_url="/docs" if settings.app_env != "production" else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    if settings.cors_origins_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins_list,
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.middleware("http")
    async def request_context(request: Request, call_next):
        # Honor an upstream X-Request-ID so logs can be correlated across
        # services (web -> api). Otherwise mint a new one.
        rid = request.headers.get("x-request-id") or new_request_id()
        set_request_id(rid)
        started = time.perf_counter()
        try:
            response = await call_next(request)
        finally:
            elapsed_ms = (time.perf_counter() - started) * 1000
            logger.info(
                "request",
                extra={
                    "method": request.method,
                    "path": request.url.path,
                    "elapsed_ms": round(elapsed_ms, 2),
                },
            )
            set_request_id(None)
        response.headers["x-request-id"] = rid
        return response

    app.include_router(health_router)
    return app


app = create_app()
