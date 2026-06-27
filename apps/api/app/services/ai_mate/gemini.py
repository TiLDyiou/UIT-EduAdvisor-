from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.core.config import Settings

logger = logging.getLogger(__name__)

_EMBED_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent"
)


async def _call_embed(settings: Settings, text: str) -> list[float]:
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.ai_gemini_api_key,
    }
    body = {
        "content": {"parts": [{"text": text}]},
        "output_dimensionality": 768,
    }
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        r = await client.post(_EMBED_URL, headers=headers, json=body)
        r.raise_for_status()
        data = r.json()
    return data["embedding"]["values"]


async def embed_text(settings: Settings, text: str) -> list[float]:
    formatted = f"task: question answering | query: {text}"
    logger.debug("embed_text: %d chars", len(text))
    return await _call_embed(settings, formatted)


async def batch_embed_texts(
    settings: Settings,
    texts: list[str],
    *,
    title: str | None = None,
) -> list[list[float]]:
    if not texts:
        return []
    title_str = title if title is not None else "none"
    results: list[list[float]] = []
    for t in texts:
        formatted = f"title: {title_str} | text: {t}"
        vec = await _call_embed(settings, formatted)
        results.append(vec)
    logger.debug("batch_embed_texts: %d texts embedded", len(results))
    return results


_GROQ_BASE = "https://api.groq.com/openai/v1"


async def stream_generate_content(
    settings: Settings,
    *,
    system_instruction: str,
    user_text: str,
) -> AsyncIterator[str]:
    # Groq streaming completion
    if not settings.groq_api_key.strip():
        return
    url = f"{_GROQ_BASE}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key.strip()}",
        "Content-Type": "application/json",
    }
    body: dict[str, Any] = {
        "model": settings.groq_model,
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_text},
        ],
        "temperature": 0.6,
        "stream": True,
    }
    timeout = httpx.Timeout(
        connect=10.0,
        read=None,
        write=10.0,
        pool=10.0,
    )
    read_timeout = settings.ai_chat_timeout_seconds
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST",
            url,
            headers=headers,
            json=body,
            timeout=httpx.Timeout(read_timeout),
        ) as resp:
            resp.raise_for_status()
            async for raw_line in resp.aiter_lines():
                if not raw_line:
                    continue
                if raw_line.startswith("data: "):
                    payload = raw_line[6:].strip()
                    if payload in ("[DONE]", ""):
                        continue
                    try:
                        obj = json.loads(payload)
                    except json.JSONDecodeError:
                        continue
                    for choice in obj.get("choices") or []:
                        delta = choice.get("delta") or {}
                        t = delta.get("content")
                        if isinstance(t, str) and t:
                            yield t


async def generate_json_text(settings: Settings, *, system_instruction: str, user_text: str) -> str:
    # Groq JSON completion
    if not settings.groq_api_key.strip():
        return '{"courses_of_interest":[],"recent_questions":[]}'
    url = f"{_GROQ_BASE}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key.strip()}",
        "Content-Type": "application/json",
    }
    body: dict[str, Any] = {
        "model": settings.groq_model,
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_text},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    timeout = httpx.Timeout(settings.ai_chat_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(url, headers=headers, json=body)
        r.raise_for_status()
        data = r.json()
    choice = (data.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    return message.get("content") or ""
