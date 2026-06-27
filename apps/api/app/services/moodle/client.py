"""Moodle HTTP login + authenticated GET."""

from __future__ import annotations

import httpx

from app.core.config import Settings
from app.services.moodle.errors import MoodleAuthError
from app.services.moodle.parser import login_failed, parse_login_token


def _client(settings: Settings) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.moodle_base_url.rstrip("/") + "/",
        headers={"User-Agent": settings.http_user_agent},
        timeout=settings.http_timeout_seconds,
        follow_redirects=True,
    )


async def moodle_login(settings: Settings, *, username: str, password: str) -> httpx.AsyncClient:
    client = _client(settings)
    try:
        login_path = settings.moodle_login_path.lstrip("/")
        r = await client.get(login_path)
        r.raise_for_status()
        token = parse_login_token(r.text)
        if not token:
            raise MoodleAuthError("missing_logintoken")
        data = {
            "logintoken": token,
            "username": username,
            "password": password,
        }
        r2 = await client.post(login_path, data=data)
        r2.raise_for_status()
        if login_failed(r2.text):
            raise MoodleAuthError("moodle_login_rejected")
        return client
    except Exception:
        await client.aclose()
        raise


async def moodle_get_text(client: httpx.AsyncClient, path: str) -> str:
    r = await client.get(path.lstrip("/"))
    r.raise_for_status()
    return r.text


async def moodle_get_calendar_events_json(settings: Settings, *, username: str, password: str) -> dict:
    """Get calendar events using the Moodle Mobile App API."""
    async with _client(settings) as client:
        # 1. Get token
        token_params = {
            "username": username,
            "password": password,
            "service": "moodle_mobile_app"
        }
        r = await client.get("login/token.php", params=token_params)
        r.raise_for_status()
        data = r.json()
        
        if "token" not in data:
            raise MoodleAuthError("moodle_mobile_login_failed")
            
        token = data["token"]
        
        # 2. Fetch action events by timesort
        import time
        api_params = {
            "wstoken": token,
            "wsfunction": "core_calendar_get_action_events_by_timesort",
            "moodlewsrestformat": "json",
            "timesortfrom": int(time.time()),
            "limitnum": 50,
        }
        r2 = await client.get("webservice/rest/server.php", params=api_params)
        r2.raise_for_status()
        return r2.json()
