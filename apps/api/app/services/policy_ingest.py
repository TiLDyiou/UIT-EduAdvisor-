from __future__ import annotations

import hashlib
import re
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


_RE_CHUONG = re.compile(r"(CHƯƠNG\s+\d+\.?\s*.+)", re.MULTILINE)
_RE_DIEU = re.compile(r"(Điều\s+\d+\.\s*.+)", re.MULTILINE)


def chunk_policy_text(text: str, doc_title: str) -> list[dict]:
    # Find body start: first CHƯƠNG line that is NOT in the TOC.
    # TOC lines have dots (\.{3,}) or end with a standalone page number.
    body_start = 0
    for m in _RE_CHUONG.finditer(text):
        nl = text.find("\n", m.start())
        line = text[m.start() : nl if nl != -1 else len(text)].rstrip()
        if not re.search(r"\.{3,}", line) and not re.search(r"\s+\d{1,3}\s*$", line):
            body_start = m.start()
            break

    body = text[body_start:]

    # Check if structured patterns exist
    if not _RE_CHUONG.search(body) or not _RE_DIEU.search(body):
        return [{"content": c, "section_header": ""} for c in chunk_text(text)]

    # Split body into Điều segments while tracking current CHƯƠNG
    current_chuong = ""
    chunks: list[dict] = []
    # Merge CHƯƠNG and Điều markers with positions
    markers = []
    for m in _RE_CHUONG.finditer(body):
        markers.append((m.start(), "chuong", m.group(1).strip()))
    for m in _RE_DIEU.finditer(body):
        markers.append((m.start(), "dieu", m.group(1).strip()))
    markers.sort(key=lambda x: x[0])

    # Collect Điều ranges
    dieu_sections: list[tuple[str, str, int, int]] = []  # (chuong, dieu_header, start, end)
    for i, (pos, kind, header) in enumerate(markers):
        if kind == "chuong":
            current_chuong = header
        elif kind == "dieu":
            start = pos
            # end = next marker start or end of body
            end = markers[i + 1][0] if i + 1 < len(markers) else len(body)
            dieu_sections.append((current_chuong, header, start, end))

    if not dieu_sections:
        return [{"content": c, "section_header": ""} for c in chunk_text(text)]

    for chuong, dieu_header, start, end in dieu_sections:
        dieu_text = body[start:end].strip()
        prefix = f"{chuong}\n" if chuong else ""
        full_content = prefix + dieu_text

        if len(full_content) <= 2000:
            chunks.append({"content": full_content, "section_header": dieu_header})
        else:
            # Sub-split large Điều using fixed-size chunking
            sub_chunks = chunk_text(dieu_text, size=1200, overlap=200)
            for sc in sub_chunks:
                chunk_content = f"{prefix}{dieu_header}\n{sc}"
                chunks.append({"content": chunk_content, "section_header": dieu_header})

    return chunks


def pseudo_embedding_768(text: str) -> list[float]:
    # Fallback deterministic embedding để hệ thống chạy local ngay cả khi chưa có provider thật.
    digest = hashlib.sha256(text.encode("utf-8")).digest()
    vals = []
    for i in range(768):
        b = digest[i % len(digest)]
        vals.append((b / 255.0) * 2.0 - 1.0)
    return vals
