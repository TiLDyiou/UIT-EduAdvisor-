"""HTTP client for DAA (Drupal) login and authenticated fetches."""

from __future__ import annotations

import base64
import json
import secrets
from dataclasses import asdict, dataclass
from typing import Any
from urllib.parse import urlparse

import httpx
from redis.asyncio import Redis

from app.core.config import Settings
from app.services.daa.errors import DaaAuthError
from app.services.daa.parser import DaaLoginForm, get_login_error, login_failed, parse_login_form


def _cookie_snapshot(client: httpx.AsyncClient, base_url: str) -> list[dict[str, str]]:
    snap: list[dict[str, str]] = []
    try:
        for c in client.cookies.jar:
            snap.append(
                {
                    "name": c.name,
                    "value": c.value,
                    "domain": c.domain or "",
                    "path": c.path or "/",
                }
            )
        if snap:
            return snap
    except Exception:
        pass
    host = urlparse(base_url).hostname or ""
    return [{"name": k, "value": v, "domain": host, "path": "/"} for k, v in client.cookies.items()]


def _apply_cookie_snapshot(client: httpx.AsyncClient, snap: list[dict[str, str]]) -> None:
    client.cookies.clear()
    for c in snap:
        domain = c["domain"] or None
        client.cookies.set(c["name"], c["value"], domain=domain, path=c["path"] or "/")


@dataclass
class DaaCaptchaBundle:
    captcha_state_id: str
    question: str
    image_base64: str | None


async def store_captcha_state(redis: Redis, payload: dict[str, Any], ttl: int) -> str:
    state_id = secrets.token_urlsafe(24)
    await redis.set(f"daa:captcha:{state_id}", json.dumps(payload), ex=ttl)
    return state_id


async def load_captcha_state(redis: Redis, state_id: str) -> dict[str, Any] | None:
    raw = await redis.get(f"daa:captcha:{state_id}")
    if not raw:
        return None
    return json.loads(raw)


async def delete_captcha_state(redis: Redis, state_id: str) -> None:
    await redis.delete(f"daa:captcha:{state_id}")


def _client(settings: Settings) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.daa_base_url.rstrip("/") + "/",
        headers={"User-Agent": settings.http_user_agent},
        timeout=settings.http_timeout_seconds,
        follow_redirects=True,
    )


async def fetch_captcha_bundle(redis: Redis, settings: Settings) -> DaaCaptchaBundle:
    async with _client(settings) as client:
        login_url = settings.daa_login_path
        r = await client.get(login_url)
        r.raise_for_status()
        page_url = str(r.url)
        form = parse_login_form(r.text, page_url)
        image_b64: str | None = None
        if form.captcha_image_url:
            img = await client.get(form.captcha_image_url)
            if img.status_code == 200:
                image_b64 = base64.b64encode(img.content).decode("ascii")

        payload = {
            "cookies": _cookie_snapshot(client, settings.daa_base_url),
            "form": asdict(form),
        }
        state_id = await store_captcha_state(redis, payload, settings.captcha_state_ttl_seconds)
        return DaaCaptchaBundle(
            captcha_state_id=state_id,
            question=form.question,
            image_base64=image_b64,
        )


async def daa_login_with_state(
    redis: Redis,
    settings: Settings,
    *,
    state_id: str,
    student_code: str,
    password: str,
    captcha_answer: str,
) -> httpx.AsyncClient:
    """Return an authenticated client (caller must close). Raises DaaAuthError on failure."""
    data = await load_captcha_state(redis, state_id)
    if not data:
        raise DaaAuthError("captcha_state_expired")

    form = DaaLoginForm(**data["form"])
    client = httpx.AsyncClient(
        base_url=settings.daa_base_url.rstrip("/") + "/",
        headers={"User-Agent": settings.http_user_agent},
        timeout=settings.http_timeout_seconds,
        follow_redirects=True,
    )
    try:
        _apply_cookie_snapshot(client, data["cookies"])
        body = {
            "name": student_code,
            "pass": password,
            "form_build_id": form.form_build_id,
            "form_id": form.form_id,
            "captcha_sid": form.captcha_sid,
            "captcha_token": form.captcha_token,
            form.captcha_answer_field: captcha_answer,
            "op": "Đăng nhập",
        }
        post_path = form.action_path.lstrip("/")
        resp = await client.post(post_path, data=body)
        if resp.status_code >= 400:
            raise DaaAuthError(f"daa_http_{resp.status_code}")
        err_msg = get_login_error(resp.text)
        if err_msg:
            raise DaaAuthError(err_msg)
        if login_failed(resp.text):
            raise DaaAuthError("daa_login_rejected")
        return client
    except Exception:
        await client.aclose()
        raise


async def daa_get_text(client: httpx.AsyncClient, path: str) -> str:
    r = await client.get(path.lstrip("/"))
    r.raise_for_status()
    return r.text
