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


def get_login_error(html: str) -> str | None:
    """Extract actual error message from Drupal error divs if any."""
    soup = BeautifulSoup(html, "html.parser")
    err_div = soup.select_one("div.messages.error")
    if err_div:
        return err_div.get_text(" ", strip=True)
    alert_div = soup.select_one("div.alert-error")
    if alert_div:
        return alert_div.get_text(" ", strip=True)
    return None


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
            headers = [
                _norm_header(td.get_text(" ", strip=True)) for td in first_row.find_all("td")
            ]
        col_idx = {h: i for i, h in enumerate(headers) if h}
        code_headers = {"ma mon", "ma mon hoc", "ma hp", "ma hoc phan", "course", "course code"}
        name_headers = {"ten mon", "ten mon hoc", "ten hp", "ten hoc phan", "course name"}
        credit_headers = {"so tin chi", "tin chi", "tc", "credits"}
        term_headers = {"hoc ky", "ky", "term"}
        grade_headers = {
            "diem",
            "diem tk",
            "diem tong ket",
            "tong ket",
            "grade",
            "final grade",
            "diem hp",
            "diem hoc phan",
            "iem hp",
        }

        comp_matchers = {
            "Quá trình": {"diem qt", "diem qua trinh", "qt"},
            "Giữa kỳ": {"diem gk", "diem giua ky", "gk"},
            "Thực hành": {"diem th", "diem thuc hanh", "th"},
            "Cuối kỳ": {"diem ck", "diem cuoi ky", "ck"},
        }

        comp_idx = {}
        for comp_name, matchers in comp_matchers.items():
            for h, i in col_idx.items():
                if h in matchers:
                    comp_idx[comp_name] = i
                    break

        if not any(k in col_idx for k in code_headers):
            continue
        body_rows = table.find_all("tr")[1:] if headers else table.find_all("tr")
        current_term: str | None = None
        for tr in body_rows:
            cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
            # Detect term separator rows: "Học kỳ X - Năm học YYYY-YYYY" (colspan, usually 1 cell)
            tds = tr.find_all("td")
            if len(tds) >= 1 and tds[0].get("colspan"):
                text = cells[0].strip()
                m = re.search(
                    r"H[oọ]c\s+k[yỳ]\s+(\d)\s*-\s*N[aă]m\s+h[oọ]c\s+(\d{4})\s*-\s*(\d{4})",
                    text,
                    re.I,
                )
                if m:
                    current_term = f"HK{m.group(1)}_{m.group(2)}-{m.group(3)}"
                continue
            if len(cells) < 2:
                continue
            # Skip summary rows like "Trung bình học kỳ"
            joined = " ".join(cells).lower()
            if "trung bình" in joined or "tín chỉ" in joined or "điểm trung bình" in joined:
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

            detailed_grades = {}
            for comp_name, i in comp_idx.items():
                if i < len(cells):
                    comp_grade = _parse_decimal_maybe(cells[i])
                    if comp_grade is not None:
                        detailed_grades[comp_name] = comp_grade
            if code:
                rows_out.append(
                    {
                        "course_code": code,
                        "course_name": name,
                        "credits": credits,
                        "term_code": term or current_term or "unknown",
                        "final_grade_10": grade,
                        "detailed_grades": detailed_grades,
                    }
                )
    return rows_out


def parse_schedule_rows(html: str) -> list[dict[str, str | int | None]]:
    soup = BeautifulSoup(html, "html.parser")
    out: list[dict[str, str | int | None]] = []
    
    def _norm(s: str) -> str:
        s = s.lower().strip()
        s = s.replace("\u0111", "d").replace("\u0110", "d")
        import unicodedata
        return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
        
    for table in soup.select("table"):
        headers = [_norm(th.get_text(" ", strip=True)) for th in table.find_all("th")]
        if not headers:
            continue
            
        joined = " ".join(headers)
        if "thu" not in joined and "tiet" not in joined:
            continue
            
        col_idx = {}
        for i, h in enumerate(headers):
            if h in ("thu", "thu trong tuan"):
                col_idx["day"] = i
            elif h in ("tiet", "tiet bd", "tiet hoc", "tiet bat dau"):
                col_idx["start"] = i
            elif h in ("so tiet", "st"):
                col_idx["duration"] = i
            elif h in ("mamh", "ma mh", "ma hp", "ma hoc phan"):
                col_idx["code"] = i
            elif h in ("ten mon", "ten mh", "ten hoc phan", "ten hp", "mon hoc"):
                col_idx["name"] = i
            elif h in ("phong", "phong hoc"):
                col_idx["room"] = i
                
        if "day" not in col_idx or "start" not in col_idx or "code" not in col_idx:
            continue
            
        for tr in table.find_all("tr")[1:]:
            cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
            if len(cells) <= max(col_idx.values()):
                continue
                
            day_cell = cells[col_idx["day"]]
            start_cell = cells[col_idx["start"]]
            
            day = _parse_int_maybe(day_cell)
            start = _parse_int_maybe(start_cell)
            
            if not day or not start:
                continue
                
            duration = 1
            if "duration" in col_idx:
                d = _parse_int_maybe(cells[col_idx["duration"]])
                if d: duration = d
                
            # sometimes start_cell is "1-3" or "45" (e.g. if 'tiet' contains multiple periods instead of start + duration)
            m_range = re.search(r"(\d+)\s*-\s*(\d+)", start_cell)
            if m_range:
                start = int(m_range.group(1))
                end = int(m_range.group(2))
            else:
                # e.g. "45"
                m_digits = re.search(r"(\d)(\d+)", start_cell)
                if m_digits and len(start_cell.strip()) >= 2 and duration == 1:
                    start = int(m_digits.group(1))
                    end = int(start_cell.strip()[-1])
                    if end == 0: end = 10
                else:
                    end = start + duration - 1
            
            course_code = _extract_course_code(cells[col_idx["code"]])
            if not course_code:
                continue
                
            name = cells[col_idx["name"]] if "name" in col_idx else None
            room = cells[col_idx["room"]] if "room" in col_idx else None
            
            out.append({
                "day_of_week": day,
                "start_period": start,
                "end_period": end,
                "course_code": course_code,
                "course_name": name,
                "room": room,
            })
            
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
    # Vietnamese đ/Đ (U+0111/U+0110) are not decomposed by NFD; replace explicitly
    lowered = lowered.replace("\u0111", "d").replace("\u0110", "d")
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
    return bool(re.fullmatch(r"[A-Z0-9]+(?:\.[A-Z0-9]+)*", s)) and any(ch.isdigit() for ch in s)


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


def parse_daa_exam_schedule(html: str, lanthi: int, hocky: int, namhoc: int) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    out = []
    
    term_code = f"HK{hocky}_{namhoc}-{namhoc+1}"
    
    table = soup.find("table", class_="sticky-table") or soup.find("table")
    if not table:
        return out
        
    tbody = table.find("tbody")
    if not tbody:
        tbody = table
        
    from datetime import date, datetime, time, timedelta
    
    for tr in tbody.find_all("tr"):
        cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
        if len(cells) < 8 or "empty" in "".join(tr.get("class", [])) or "Hiện tại bạn" in "".join(cells):
            continue
            
        course_code = cells[1].strip()
        shift_str = cells[3].strip()
        
        lowered = shift_str.lower()
        if "ca 1" in lowered or "tiet 1" in lowered or "ca1" in lowered:
            start_time = time(7, 30)
        elif "ca 2" in lowered or "tiet 4" in lowered or "ca2" in lowered:
            start_time = time(9, 30)
        elif "ca 3" in lowered or "tiet 7" in lowered or "ca3" in lowered:
            start_time = time(13, 30)
        elif "ca 4" in lowered or "tiet 10" in lowered or "ca4" in lowered:
            start_time = time(15, 30)
        else:
            time_matches = re.findall(r"(\d{1,2})[h:](\d{2})", shift_str)
            if len(time_matches) >= 1:
                h1, m1 = map(int, time_matches[0])
                start_time = time(h1, m1)
            else:
                start_time = time(7, 30)
                
        end_time = None
                
        date_str = cells[5].strip().replace("-", "/")
        try:
            exam_date = datetime.strptime(date_str, "%d/%m/%Y").date()
            if exam_date.year > namhoc + 1:
                # Tránh lỗi DAA tự động thêm năm hiện tại vào các kỳ thi năm ngoái.
                exam_date = exam_date.replace(year=namhoc if hocky == 1 else namhoc + 1)
                
            exam_datetime = datetime.combine(exam_date, start_time)
            if exam_datetime < datetime.now():
                continue
        except Exception:
            continue
            
        room = cells[6].strip() if len(cells) > 6 else None
        kind = cells[7].strip() if len(cells) > 7 else None
        
        kind_label = "Giữa kỳ" if lanthi == 1 else "Cuối kỳ"
            
        out.append({
            "course_code": course_code,
            "term_code": term_code,
            "exam_date": exam_date,
            "start_time": start_time,
            "end_time": end_time,
            "room": room,
            "kind": kind_label[:32],
        })
        
    return out


def parse_grades_summary(html: str) -> dict[str, float | int | None]:
    """Parse ĐTBC, ĐTBCTL and earned credits from /sinhvien/kqhoctap.

    DAA page structure (last 4 <tr> of the grades table):
      - "So tin chi da hoc"           → credits in td[3]
      - "So tin chi tich luy"         → credits in td[3]
      - "Diem trung binh chung"       → GPA (scale 10) in td[8]
      - "Diem trung binh chung tich luy" → GPA (scale 10) in td[8]
    """
    soup = BeautifulSoup(html, "html.parser")
    result: dict[str, float | int | None] = {
        "dtbc_10": None,
        "dtbctl_10": None,
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

        if "diem trung binh" in label and "tich luy" in label:
            for cell in cells[1:]:
                m = decimal_re.search(_text(cell))
                if m:
                    result["dtbctl_10"] = float(m.group(0).replace(",", "."))
                    break

        elif "diem trung binh" in label and "tich luy" not in label and "hoc ky" not in label:
            for cell in cells[1:]:
                m = decimal_re.search(_text(cell))
                if m:
                    result["dtbc_10"] = float(m.group(0).replace(",", "."))
                    break

        elif "tin chi tich luy" in label:
            for cell in cells[1:]:
                txt = _text(cell).strip()
                if re.fullmatch(r"\d+", txt):
                    result["earned_credits"] = int(txt)
                    break

    return result


def parse_registration_table(html: str) -> list[dict[str, str | int | None]]:
    """Parse the ĐKHP registration page at /sinhvien/dkhp/thongtindangky.

    Returns a list of registered courses with course_code, course_name,
    credits, and term_code extracted from the page heading.
    """
    soup = BeautifulSoup(html, "html.parser")
    rows_out: list[dict[str, str | int | None]] = []

    # Extract term info from heading like "HỌC KỲ 2 NĂM HỌC 2025 - 2026"
    term_code = "CURRENT"
    heading_text = soup.get_text(" ", strip=True)
    m = re.search(
        r"H[ỌO]C\s+K[ỲY]\s+(\d)(?:\s*-\s*|\s+)(?:N[ĂA]M\s+H[ỌO]C|N[ĂA]M)\s+(\d{4})\s*-\s*(\d{4})",
        heading_text,
        re.I,
    )
    if m:
        term_code = f"HK{m.group(1)}_{m.group(2)}-{m.group(3)}"

    # Find the registration table (has headers like STT, MãMH, Lớp, Môn, Số TC)
    seen_codes: set[str] = set()
    for table in soup.select("table"):
        headers = [_norm_header(th.get_text(" ", strip=True)) for th in table.find_all("th")]
        if not headers:
            first_row = table.find("tr")
            if first_row:
                headers = [
                    _norm_header(td.get_text(" ", strip=True)) for td in first_row.find_all("td")
                ]

        # Look for a table with MãMH/Mã MH column
        code_col = None
        name_col = None
        credit_col = None
        for i, h in enumerate(headers):
            if h in ("mamh", "ma mh", "ma mon", "ma hp"):
                code_col = i
            elif h in ("mon", "ten mon", "ten hoc phan", "ten hp"):
                name_col = i
            elif h in ("so tc", "tin chi", "tc", "so tin chi"):
                credit_col = i

        if code_col is None:
            continue

        for tr in table.find_all("tr")[1:]:
            cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")]
            if len(cells) <= code_col:
                continue

            code = cells[code_col].strip().upper()
            if not code or not _looks_like_course_code(code):
                continue

            # Skip duplicate course codes (same course with TH section)
            if code in seen_codes:
                continue
            seen_codes.add(code)

            name = (
                cells[name_col].strip() if name_col is not None and name_col < len(cells) else None
            )
            credits = None
            if credit_col is not None and credit_col < len(cells):
                try:
                    credits = int(cells[credit_col].strip())
                except (ValueError, TypeError):
                    pass

            rows_out.append(
                {
                    "course_code": code,
                    "course_name": name,
                    "credits": credits,
                    "term_code": term_code,
                }
            )

    return rows_out


MAJOR_MAPPING = {
    "ATTN": "Kỹ sư tài năng ngành An toàn Thông tin",
    "KHTN": "Cử nhân tài năng ngành Khoa học Máy tính",
    "ATBC": "Ngành Mạng máy tính và An toàn thông tin – Chương trình liên kết BCU",
    "ATCL": "Ngành An toàn Thông tin – Chương trình Chất lượng cao",
    "ATTT": "Ngành An toàn Thông tin",
    "CNCL": "Ngành Công nghệ Thông tin – Chương trình Chất lượng cao định hướng Nhật Bản",
    "CNTT": "Ngành Công nghệ Thông tin",
    "CTTT": "Ngành Hệ thống Thông tin – Chương trình tiên tiến",
    "HTCL": "Ngành Hệ thống Thông tin",
    "HTTT": "Ngành Hệ thống Thông tin",
    "KHBC": "Ngành Khoa học Máy tính – Chương trình liên kết BCU",
    "KHCL": "Ngành Khoa học Máy tính – Chương trình Chất lượng cao",
    "KHDL": "Ngành Khoa học Dữ liệu",
    "KHMT": "Ngành Khoa học Máy tính",
    "KHNT": "Ngành Khoa học Máy tính – Chuyên ngành Trí tuệ Nhân tạo",
    "KTMT": "Ngành Kỹ thuật Máy tính",
    "KTPM": "Ngành Kỹ thuật Phần mềm",
    "MMCL": "Ngành Mạng máy tính và truyền thông dữ liệu – Chương trình Chất lượng cao",
    "MMTT": "Ngành Mạng máy tính và truyền thông dữ liệu",
    "MTCL": "Ngành Kỹ thuật Máy tính – Chương trình Chất lượng cao",
    "MTIO": "Ngành Kỹ thuật Máy tính – Chuyên ngành Hệ thống nhúng và IoT",
    "PMCL": "Ngành Kỹ thuật Phần mềm – Chương trình Chất lượng cao",
    "TMCL": "Ngành Thương mại Điện tử – Chương trình Chất lượng cao",
    "TMĐT": "Ngành Thương mại Điện tử",
    "TTĐPT": "Truyền thông Đa phương tiện",
}


def parse_class_code_info(html: str) -> tuple[str | None, int | None]:
    """Parse class code from DAA grades page to extract major_name and enrollment_year."""
    soup = BeautifulSoup(html, "html.parser")
    # Search for "Lớp sinh hoạt:" in table cells
    for td in soup.find_all("td"):
        text = td.get_text(" ", strip=True).lower()
        if "lớp sinh hoạt" in text:
            # The next sibling td or the text inside this td might contain the class code
            next_td = td.find_next_sibling("td")
            val = ""
            if next_td:
                val = next_td.get_text(" ", strip=True)
            # Fallback to checking the current td if next_td is empty
            if not val:
                val = td.get_text(" ", strip=True)

            m = re.search(r"([a-zđ]+)(\d{4})", val, re.I)
            if m:
                prefix = m.group(1).upper()
                year_str = m.group(2)
                major_name = MAJOR_MAPPING.get(prefix)
                return major_name, int(year_str)
    return None, None


def parse_ics_schedule(ics_text: str | bytes) -> list[dict[str, str | int | None]]:
    import icalendar
    cal = icalendar.Calendar.from_ical(ics_text)
    out = []
    
    day_map = {'MO': 2, 'TU': 3, 'WE': 4, 'TH': 5, 'FR': 6, 'SA': 7, 'SU': 8}
    
    for component in cal.walk():
        if component.name == "VEVENT":
            summary = str(component.get('summary', ''))
            description = str(component.get('description', ''))
            
            course_code = summary.split(' - ')[0].strip()
            course_name = course_code
            name_match = re.search(r'\((.*?)\)', description)
            if name_match:
                course_name = name_match.group(1)
                
            rrule = component.get('rrule')
            day_of_week = 2
            if rrule and 'BYDAY' in rrule:
                byday = rrule['BYDAY'][0]
                day_of_week = day_map.get(byday, 2)
                
            start_p = 1
            end_p = 1
            period_match = re.search(r'Tiết\s+(\d+)', description)
            if period_match:
                periods = period_match.group(1)
                start_p = int(periods[0])
                if periods[-1] == '0':
                    end_p = 10
                else:
                    end_p = int(periods[-1])
                    
            room = summary.split('- P. ')[-1].strip() if '- P. ' in summary else None
            
            week_pattern = "Hàng tuần"
            if "Cách" in description:
                freq_match = re.search(r'Cách\s+\d+\s+tuần', description, re.IGNORECASE)
                if freq_match:
                    week_pattern = freq_match.group(0)
                    
            out.append({
                "course_code": course_code,
                "course_name": course_name,
                "day_of_week": day_of_week,
                "start_period": start_p,
                "end_period": end_p,
                "room": room,
                "week_pattern": week_pattern,
            })
            
    return out
