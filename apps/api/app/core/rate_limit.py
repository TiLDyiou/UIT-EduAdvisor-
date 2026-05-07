"""Redis sliding-window rate limit (counts requests per key per time window)."""

from __future__ import annotations

import time
import uuid

from redis.asyncio import Redis


class RateLimiter:
    def __init__(self, redis_client: Redis) -> None:
        self._r = redis_client

    async def check(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int, int]:
        """Return (allowed, remaining, reset_in_seconds)."""
        now = time.time()
        zkey = f"rl:{key}"
        await self._r.zremrangebyscore(zkey, "-inf", now - window_seconds)
        current = int(await self._r.zcard(zkey))
        if current >= limit:
            oldest = await self._r.zrange(zkey, 0, 0, withscores=True)
            if oldest:
                oldest_ts = float(oldest[0][1])
                reset_in = max(1, int(window_seconds - (now - oldest_ts)))
            else:
                reset_in = window_seconds
            return False, 0, reset_in

        member = f"{now}:{uuid.uuid4().hex}"
        await self._r.zadd(zkey, {member: now})
        await self._r.expire(zkey, window_seconds + 1)
        new_count = int(await self._r.zcard(zkey))
        remaining = max(0, limit - new_count)
        return True, remaining, window_seconds
