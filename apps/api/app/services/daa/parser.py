"""Parse Drupal DAA HTML (login + generic tables)."""

from __future__ import annotations

import re
import unicodedata
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
        headers = [_norm_header(th.get_text(" ", strip=True)) for th in table.find_all("th")]
        if not headers:
            first_row = table.find("tr")
            if not first_row:
                continue
            headers = [_norm_header(td.get_text(" ", strip=True)) for td in first_row.find_all("td")]
        col_idx = {h: i for i, h in enumerate(headers) if h}
        code_headers = {"ma mon", "ma mon hoc", "ma hp", "ma hoc phan", "course", "course code"}
        name_headers = {"ten mon", "ten mon hoc", "ten hp", "ten hoc phan", "course name"}
        credit_headers = {"so tin chi", "tin chi", "tc", "credits"}
        term_headers = {"hoc ky", "ky", "term"}
        grade_headers = {"diem", "diem tk", "diem tong ket", "tong ket", "grade", "final grade"}

        if not any(k in col_idx for k in code_headers):
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
                if h in code_headers:
                    code = val or code
                if h in name_headers:
                    name = val or name
                if h in credit_headers:
                    try:
                        credits = int(float(val.replace(",", ".")))
                    except Exception:
                        credits = None
                if h in term_headers:
                    term = val or term
                if h in grade_headers:
                    grade = _parse_decimal_maybe(val)
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
            course_cell = cells[3] if len(cells) > 3 else None
            out.append(
                {
                    "day_of_week": _parse_int_maybe(cells[0]),
                    "start_period": _parse_int_maybe(cells[1]),
                    "end_period": _parse_int_maybe(cells[2]),
                    "course_code": _extract_course_code(course_cell),
                    "course_name": course_cell,
                    "room": cells[-1] if len(cells) > 4 else None,
                }
            )
    return out


def _parse_int_maybe(s: str) -> int | None:
    m = re.search(r"\d+", s)
    return int(m.group(0)) if m else None


def _parse_decimal_maybe(s: str) -> Decimal | None:
    m = re.search(r"\d+(?:[.,]\d+)?", s)
    if not m:
        return None
    with_value = m.group(0).replace(",", ".")
    try:
        return Decimal(with_value)
    except Exception:
        return None


def _norm_header(s: str) -> str:
    lowered = s.strip().lower()
    normalized = unicodedata.normalize("NFD", lowered)
    no_marks = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    compact = re.sub(r"[^a-z0-9]+", " ", no_marks)
    return re.sub(r"\s+", " ", compact).strip()


def _extract_course_code(s: str | None) -> str | None:
    if not s:
        return None
    text = re.sub(r"\s+", " ", s).strip()
    if not text:
        return None

    first_token = text.split(" ", 1)[0].strip(".,;:-")
    if _looks_like_course_code(first_token):
        return first_token

    m = re.search(r"\b([A-Z]{2,}\d{2,4}(?:\.[A-Z0-9]+)*)\b", text.upper())
    if not m:
        return None
    code = m.group(1)
    return code if _looks_like_course_code(code) else None


def _looks_like_course_code(s: str) -> bool:
    return bool(re.fullmatch(r"[A-Z0-9]+(?:\.[A-Z0-9]+)*", s)) and any(
        ch.isdigit() for ch in s
    )


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
                    "course_code": _extract_course_code(cells[0]),
                    "exam_datetime": cells[1] if len(cells) > 1 else None,
                    "room": cells[-1],
                }
            )
    return out


def _grade_10_to_4(g10: float) -> float:
    """Convert UIT grade scale 10 to scale 4."""
    if g10 >= 9.0:
        return 4.0
    if g10 >= 8.0:
        return 3.5
    if g10 >= 7.0:
        return 3.0
    if g10 >= 6.0:
        return 2.5
    if g10 >= 5.0:
        return 2.0
    if g10 >= 4.0:
        return 1.5
    if g10 >= 3.0:
        return 1.0
    return 0.0


def parse_grades_summary(html: str) -> dict[str, float | int | None]:
    """Parse ĐTBC, ĐTBCTL and earned credits from /sinhvien/kqhoctap.

    DAA page structure (last 4 <tr> of the grades table):
      - "So tin chi da hoc"           → credits in td[3]
      - "So tin chi tich luy"         → credits in td[3]
      - "Diem trung binh chung"       → GPA (scale 10) in td[8]
      - "Diem trung binh chung tich luy" → GPA (scale 10) in td[8]
    Scale 4 is computed locally using UIT conversion table.
    """
    soup = BeautifulSoup(html, "html.parser")
    result: dict[str, float | int | None] = {
        "dtbc_10": None,
        "dtbc_4": None,
        "dtbctl_10": None,
        "dtbctl_4": None,
        "earned_credits": None,
    }

    all_trs = soup.find_all("tr")
    if len(all_trs) < 4:
        return result

    decimal_re = re.compile(r"\d+[.,]\d+")

    def _text(el) -> str:
        return el.get_text(" ", strip=True) if el else ""

    def _norm(text: str) -> str:
        lowered = text.strip().lower()
        # Vietnamese đ (U+0111) is not decomposed by NFKD, replace explicitly
        lowered = lowered.replace("\u0111", "d").replace("\u0110", "d")
        return unicodedata.normalize("NFKD", lowered).encode("ascii", "ignore").decode()

    for tr in all_trs:
        cells = tr.find_all("td")
        if not cells:
            continue
        label = _norm(_text(cells[0]))

        if "diem trung binh chung tich luy" in label:
            # ĐTBCTL row — GPA in cells[6] (colspan=3 label reduces 10 cols to 8)
            if len(cells) > 6:
                m = decimal_re.search(_text(cells[6]))
                if m:
                    val = float(m.group(0).replace(",", "."))
                    result["dtbctl_10"] = val
                    result["dtbctl_4"] = _grade_10_to_4(val)

        elif "diem trung binh chung" in label:
            # ĐTBC row — GPA in cells[6]
            if len(cells) > 6:
                m = decimal_re.search(_text(cells[6]))
                if m:
                    val = float(m.group(0).replace(",", "."))
                    result["dtbc_10"] = val
                    result["dtbc_4"] = _grade_10_to_4(val)

        elif "so tin chi tich luy" in label:
            # Earned credits in the 4th cell (index 3), or next available int
            for cell in cells[1:]:
                txt = _text(cell).strip()
                if re.fullmatch(r"\d+", txt):
                    result["earned_credits"] = int(txt)
                    break

    return result

