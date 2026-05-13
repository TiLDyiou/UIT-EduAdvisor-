from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.core.config import Settings
from app.services.policy_ingest import pseudo_embedding_768

_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


def _headers() -> dict[str, str]:
    return {"Content-Type": "application/json"}


async def embed_text(settings: Settings, text: str) -> list[float]:
    if not settings.ai_gemini_api_key.strip():
        return pseudo_embedding_768(text)
    url = (
        f"{_GEMINI_BASE}/models/{settings.ai_embedding_model}:embedContent"
        f"?key={settings.ai_gemini_api_key}"
    )
    body: dict[str, Any] = {
        "model": f"models/{settings.ai_embedding_model}",
        "content": {"parts": [{"text": text}]},
        "outputDimensionality": 768,
    }
    timeout = httpx.Timeout(settings.ai_chat_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(url, headers=_headers(), json=body)
        r.raise_for_status()
        data = r.json()
    emb = (data.get("embedding") or {}).get("values")
    if not isinstance(emb, list) or len(emb) != 768:
        raise ValueError("invalid_embedding_response")
    return [float(x) for x in emb]


async def batch_embed_texts(settings: Settings, texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    if not settings.ai_gemini_api_key.strip():
        return [pseudo_embedding_768(t) for t in texts]
    url = (
        f"{_GEMINI_BASE}/models/{settings.ai_embedding_model}:batchEmbedContents"
        f"?key={settings.ai_gemini_api_key}"
    )
    batch_size = 100
    out: list[list[float]] = []
    timeout = httpx.Timeout(settings.ai_chat_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        for i in range(0, len(texts), batch_size):
            chunk = texts[i : i + batch_size]
            body = {
                "requests": [
                    {
                        "model": f"models/{settings.ai_embedding_model}",
                        "content": {"parts": [{"text": t}]},
                        "outputDimensionality": 768,
                    }
                    for t in chunk
                ]
            }
            r = await client.post(url, headers=_headers(), json=body)
            r.raise_for_status()
            data = r.json()
            embeddings = data.get("embeddings") or []
            for item in embeddings:
                vals = item.get("values")
                if not isinstance(vals, list) or len(vals) != 768:
                    raise ValueError("invalid_batch_embedding_response")
                out.append([float(x) for x in vals])
            if len(embeddings) != len(chunk):
                raise ValueError("batch_embedding_count_mismatch")
    return out


async def stream_generate_content(
    settings: Settings,
    *,
    system_instruction: str,
    user_text: str,
) -> AsyncIterator[str]:
    if not settings.ai_gemini_api_key.strip():
        return
    url = (
        f"{_GEMINI_BASE}/models/{settings.ai_gemini_model}:streamGenerateContent"
        f"?key={settings.ai_gemini_api_key}&alt=sse"
    )
    body: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
        "generationConfig": {"temperature": 0.6},
    }
    timeout = httpx.Timeout(
        connect=10.0,
        read=None,
        write=10.0,
        pool=10.0,
    )
    read_timeout = settings.ai_chat_timeout_seconds
    async with httpx.AsyncClient(timeout=timeout) as client:  # noqa: SIM117
        async with client.stream(
            "POST",
            url,
            headers=_headers(),
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
                    for cand in obj.get("candidates") or []:
                        content = cand.get("content") or {}
                        for part in content.get("parts") or []:
                            t = part.get("text")
                            if isinstance(t, str) and t:
                                yield t


async def generate_json_text(settings: Settings, *, system_instruction: str, user_text: str) -> str:
    if not settings.ai_gemini_api_key.strip():
        return '{"courses_of_interest":[],"recent_questions":[]}'
    url = (
        f"{_GEMINI_BASE}/models/{settings.ai_gemini_model}:generateContent"
        f"?key={settings.ai_gemini_api_key}"
    )
    body: dict[str, Any] = {
        "systemInstruction": {"parts": [{"text": system_instruction}]},
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json",
        },
    }
    timeout = httpx.Timeout(settings.ai_chat_timeout_seconds)
    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(url, headers=_headers(), json=body)
        r.raise_for_status()
        data = r.json()
    cand0 = (data.get("candidates") or [{}])[0]
    content = cand0.get("content") or {}
    parts = content.get("parts") or []
    texts = [p.get("text") for p in parts if isinstance(p.get("text"), str)]
    return "".join(texts)
