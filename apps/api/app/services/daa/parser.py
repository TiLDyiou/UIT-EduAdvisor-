"""Parse Drupal DAA HTML (login + generic tables)."""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from app.services.daa.errors import DaaParseError


@dataclass(frozen=True)
class DaaLoginForm:
    action_path: str
    form_build_id: str
    form_id: str
    captcha_sid: str
    captcha_token: str
    captcha_answer_field: str
    question: str
    captcha_image_url: str | None


def parse_login_form(html: str, page_url: str) -> DaaLoginForm:
    soup = BeautifulSoup(html, "html.parser")
    form = soup.select_one("form#user-login")
    if form is None:
        raise DaaParseError("missing_user_login_form")
    action = form.get("action") or "/user"
    astr = str(action)
    action_path = urlparse(astr).path if astr.startswith("http") else astr

    form_build_el = form.select_one("input[name=form_build_id]")
    form_id_el = form.select_one("input[name=form_id]")
    if form_build_el is None or form_id_el is None:
        raise DaaParseError("missing_drupal_form_tokens")
    form_build_id = str(form_build_el.get("value", ""))
    form_id = str(form_id_el.get("value", ""))

    captcha_sid_el = form.select_one("input[name=captcha_sid]")
    captcha_token_el = form.select_one("input[name=captcha_token]")
    if captcha_sid_el is None or captcha_token_el is None:
        raise DaaParseError("missing_captcha_hidden_fields")

    captcha_box = form.select_one("div.captcha")
    if captcha_box is None:
        raise DaaParseError("missing_captcha_block")
    answer_input = captcha_box.select_one("input[type=text][name]")
    if answer_input is None or not answer_input.get("name"):
        raise DaaParseError("missing_captcha_answer_field")
    captcha_answer_field = str(answer_input["name"])

    strong = captcha_box.select_one("strong")
    question = strong.get_text(" ", strip=True) if strong else ""

    img = captcha_box.select_one("img")
    image_url: str | None = None
    if img and img.get("src"):
        image_url = urljoin(page_url, str(img["src"]))

    return DaaLoginForm(
        action_path=action_path,
        form_build_id=form_build_id,
        form_id=form_id,
        captcha_sid=str(captcha_sid_el.get("value", "")),
        captcha_token=str(captcha_token_el.get("value", "")),
        captcha_answer_field=captcha_answer_field,
        question=question,
        captcha_image_url=image_url,
    )


def login_failed(html: str) -> bool:
    """Heuristic: Drupal shows errors in div.messages.error."""
    soup = BeautifulSoup(html, "html.parser")
    if soup.select_one("div.messages.error"):
        return True
    return bool(soup.select_one("div.alert-error"))


def parse_profile_name(html: str) -> str | None:
    soup = BeautifulSoup(html, "html.parser")
    title = soup.select_one("h1.title, #page-title")
    if title:
        text = title.get_text(" ", strip=True)
        if text and text.lower() not in {"tài khoản người dùng", "user account"}:
            return text
    for label in soup.find_all(string=re.compile(r"Họ và tên|Họ tên|Full name", re.I)):
        parent = label.parent
        if parent is None:
            continue
        row = parent.find_parent("tr")
        if row:
            cells = row.find_all("td")
            if len(cells) >= 2:
                name = cells[1].get_text(" ", strip=True)
                if name:
                    return name
    return None


def parse_grades_tables(html: str) -> list[dict[str, str | Decimal | int | None]]:
    """Best-effort parse of academic result tables; structure varies by page."""
    soup = BeautifulSoup(html, "html.parser")
    rows_out: list[dict[str, str | Decimal | int | None]] = []
    for table in soup.select("table"):
        headers = [th.get_text(" ", strip=True).lower() for th in table.find_all("th")]
        if not headers:
            first_row = table.find("tr")
            if not first_row:
                continue
            headers = [td.get_text(" ", strip=True).lower() for td in first_row.find_all("td")]
        col_idx = {h: i for i, h in enumerate(headers) if h}
        if not any(k in col_idx for k in ("mã môn", "ma mon", "mã hp", "course")):
            continue
        body_rows = table.find_all("tr")[1:] if headers else table.find_all("tr")
        for tr in body_rows:
            cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
            if len(cells) < 2:
                continue
            code = None
            name = None
            credits = None
            term = None
            grade = None
            for h, i in col_idx.items():
                if i >= len(cells):
                    continue
                val = cells[i]
                if h in ("mã môn", "ma mon", "mã hp", "mã học phần"):
                    code = val or code
                if h in ("tên môn", "ten mon", "tên học phần"):
                    name = val or name
                if h in ("số tín chỉ", "tin chi", "tc"):
                    try:
                        credits = int(float(val.replace(",", ".")))
                    except Exception:
                        credits = None
                if h in ("học kỳ", "hoc ky", "kỳ", "ky"):
                    term = val or term
                if h in ("điểm", "diem", "điểm tk", "điểm tổng kết"):
                    try:
                        grade = Decimal(val.replace(",", "."))
                    except Exception:
                        grade = None
            if code:
                rows_out.append(
                    {
                        "course_code": code,
                        "course_name": name,
                        "credits": credits,
                        "term_code": term or "unknown",
                        "final_grade_10": grade,
                    }
                )
    return rows_out


def parse_schedule_rows(html: str) -> list[dict[str, str | int | None]]:
    soup = BeautifulSoup(html, "html.parser")
    out: list[dict[str, str | int | None]] = []
    for table in soup.select("table"):
        headers = [th.get_text(" ", strip=True).lower() for th in table.find_all("th")]
        if not headers:
            continue
        joined = " ".join(headers)
        if "thứ" not in joined and "tiet" not in joined and "tiết" not in joined:
            continue
        for tr in table.find_all("tr")[1:]:
            cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
            if len(cells) < 3:
                continue
            out.append(
                {
                    "day_of_week": _parse_int_maybe(cells[0]),
                    "start_period": _parse_int_maybe(cells[1]),
                    "end_period": _parse_int_maybe(cells[2]),
                    "course_code": cells[3] if len(cells) > 3 else None,
                    "room": cells[-1] if len(cells) > 4 else None,
                }
            )
    return out


def _parse_int_maybe(s: str) -> int | None:
    m = re.search(r"\d+", s)
    return int(m.group(0)) if m else None


def parse_exam_rows(html: str) -> list[dict[str, str | None]]:
    soup = BeautifulSoup(html, "html.parser")
    out: list[dict[str, str | None]] = []
    for table in soup.select("table"):
        for tr in table.find_all("tr")[1:]:
            cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
            if len(cells) < 3:
                continue
            out.append(
                {
                    "course_code": cells[0],
                    "exam_datetime": cells[1] if len(cells) > 1 else None,
                    "room": cells[-1],
                }
            )
    return out
