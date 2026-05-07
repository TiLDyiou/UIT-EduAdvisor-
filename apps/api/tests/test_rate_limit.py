"""Integration tests: Redis sliding-window rate limiter."""

from __future__ import annotations

import uuid

import pytest

from app.core.rate_limit import RateLimiter

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_rate_limit_allows_within_quota_then_blocks(redis_async_client) -> None:
    rl = RateLimiter(redis_async_client)
    key = f"test:student:{uuid.uuid4().hex}:daa"

    for _ in range(3):
        allowed, remaining, _reset = await rl.check(key, limit=3, window_seconds=60)
        assert allowed is True
        assert remaining >= 0

    allowed, remaining, reset_in = await rl.check(key, limit=3, window_seconds=60)
    assert allowed is False
    assert remaining == 0
    assert reset_in >= 1
