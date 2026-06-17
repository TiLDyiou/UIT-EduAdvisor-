from __future__ import annotations

import hashlib
from pathlib import Path

from docx import Document
from pypdf import PdfReader


def extract_policy_text(file_path: str, source_filename: str | None = None) -> str:
    path = Path(file_path)
    ext = (path.suffix or "").lower()
    if not ext and source_filename:
        ext = Path(source_filename).suffix.lower()
    if ext == ".pdf":
        return _extract_pdf_text(path)
    if ext == ".docx":
        return _extract_docx_text(path)
    raise ValueError("unsupported_policy_extension")


def _extract_pdf_text(path: Path) -> str:
    reader = PdfReader(str(path))
    parts: list[str] = []
    for page in reader.pages:
        txt = page.extract_text() or ""
        if txt.strip():
            parts.append(txt.strip())
    return "\n\n".join(parts).strip()


def _extract_docx_text(path: Path) -> str:
    doc = Document(str(path))
    parts = [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]
    return "\n".join(parts).strip()


def chunk_text(text: str, *, size: int = 1200, overlap: int = 200) -> list[str]:
    clean = " ".join(text.split())
    if not clean:
        return []
    chunks: list[str] = []
    start = 0
    n = len(clean)
    while start < n:
        end = min(start + size, n)
        chunks.append(clean[start:end])
        if end == n:
            break
        start = max(end - overlap, start + 1)
    return chunks


def pseudo_embedding_768(text: str) -> list[float]:
    # Fallback deterministic embedding để hệ thống chạy local ngay cả khi chưa có provider thật.
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    vals = []
    for i in range(768):
        b = digest[i % len(digest)]
        vals.append((b / 255.0) * 2.0 - 1.0)
    return vals
