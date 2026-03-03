"""
services/parser.py — HTML transcript parser.

Parse file điểm HTML được export từ hệ thống quản lý học vụ.
Sử dụng BeautifulSoup4 để extract thông tin sinh viên và bảng điểm.

LƯU Ý: Logic selector hiện tại dựa trên cấu trúc HTML mẫu.
Khi có file thật, chỉ cần chỉnh sửa các hằng số SELECTOR và
column indices bên dưới.
"""

import logging
from bs4 import BeautifulSoup, Tag

from schemas.schemas import ParsedGrade, ParsedTranscript

logger = logging.getLogger(__name__)

# =============================================================================
# SELECTOR CONFIG — Chỉnh sửa khi có file HTML thật
# =============================================================================

# CSS selectors để tìm thông tin sinh viên
# Giả định: thông tin nằm trong các thẻ có class/id cụ thể
STUDENT_INFO_SELECTORS = {
    "mssv": "MSSV",  # Text label trong HTML
    "ho_ten": "Họ tên",
    "major": "Ngành",
}

# Column indices trong bảng điểm (0-indexed)
GRADE_TABLE_COLUMNS = {
    "stt": 0,  # STT
    "ma_mon": 1,  # Mã môn học
    "ten_mon": 2,  # Tên môn học
    "so_tin_chi": 3,  # Số tín chỉ
    "diem_so": 4,  # Điểm số
    "diem_chu": 5,  # Điểm chữ
}

# Số cột tối thiểu để xác định đây là dòng dữ liệu hợp lệ
MIN_COLUMNS = 5


# =============================================================================
# PARSER FUNCTIONS
# =============================================================================


def _extract_student_info(soup: BeautifulSoup) -> dict[str, str]:
    """
    Extract thông tin sinh viên từ HTML.

    Strategy: Tìm các cell chứa label text (MSSV, Họ tên, Ngành),
    rồi lấy giá trị từ cell kế tiếp hoặc cùng cell.

    Args:
        soup: BeautifulSoup parsed HTML document

    Returns:
        Dict chứa mssv, ho_ten, major
    """
    info: dict[str, str] = {
        "mssv": "",
        "ho_ten": "",
        "major": "",
    }

    # Strategy 1: Tìm trong tất cả <td> elements
    all_cells = soup.find_all("td")
    for i, cell in enumerate(all_cells):
        cell_text = cell.get_text(strip=True)

        for field_key, label in STUDENT_INFO_SELECTORS.items():
            if label in cell_text:
                # Case 1: "MSSV: 12345678" — label và value trong cùng cell
                if ":" in cell_text:
                    value = cell_text.split(":", 1)[1].strip()
                    if value:
                        info[field_key] = value
                        continue

                # Case 2: Label ở cell này, value ở cell kế tiếp
                if i + 1 < len(all_cells):
                    next_value = all_cells[i + 1].get_text(strip=True)
                    if next_value:
                        info[field_key] = next_value

    # Strategy 2: Tìm trong <span>, <p>, <div> nếu không tìm thấy trong <td>
    if not info["mssv"]:
        for tag_name in ["span", "p", "div", "b", "strong"]:
            for tag in soup.find_all(tag_name):
                text = tag.get_text(strip=True)
                for field_key, label in STUDENT_INFO_SELECTORS.items():
                    if label in text and ":" in text:
                        value = text.split(":", 1)[1].strip()
                        if value and not info[field_key]:
                            info[field_key] = value

    return info


def _extract_grades(soup: BeautifulSoup) -> list[ParsedGrade]:
    """
    Extract bảng điểm từ HTML tables.

    Strategy: Tìm tất cả <table>, iterate qua <tr>,
    extract <td> theo column indices đã config.

    Args:
        soup: BeautifulSoup parsed HTML document

    Returns:
        List các ParsedGrade objects
    """
    grades: list[ParsedGrade] = []
    tables = soup.find_all("table")

    if not tables:
        logger.warning("Không tìm thấy <table> nào trong HTML")
        return grades

    for table in tables:
        rows = table.find_all("tr")

        for row in rows:
            cells = row.find_all("td")

            # Skip header rows hoặc rows không đủ columns
            if len(cells) < MIN_COLUMNS:
                continue

            try:
                # Extract data từ cells theo column config
                ma_mon = cells[GRADE_TABLE_COLUMNS["ma_mon"]].get_text(strip=True)
                ten_mon = cells[GRADE_TABLE_COLUMNS["ten_mon"]].get_text(strip=True)

                # Validate: skip nếu mã môn rỗng hoặc là header text
                if not ma_mon or ma_mon.lower() in [
                    "mã mh",
                    "mã môn",
                    "ma mon",
                    "subject code",
                ]:
                    continue

                # Parse số tín chỉ
                so_tin_chi_text = cells[GRADE_TABLE_COLUMNS["so_tin_chi"]].get_text(
                    strip=True
                )
                so_tin_chi = _safe_parse_int(so_tin_chi_text)

                # Parse điểm số
                diem_so_text = cells[GRADE_TABLE_COLUMNS["diem_so"]].get_text(
                    strip=True
                )
                diem_so = _safe_parse_float(diem_so_text)

                # Parse điểm chữ (nếu có cột)
                diem_chu: str | None = None
                if "diem_chu" in GRADE_TABLE_COLUMNS and GRADE_TABLE_COLUMNS[
                    "diem_chu"
                ] < len(cells):
                    diem_chu = (
                        cells[GRADE_TABLE_COLUMNS["diem_chu"]].get_text(strip=True)
                        or None
                    )

                grade = ParsedGrade(
                    ma_mon=ma_mon,
                    ten_mon=ten_mon,
                    so_tin_chi=so_tin_chi,
                    diem_so=diem_so,
                    diem_chu=diem_chu,
                )
                grades.append(grade)

            except (IndexError, ValueError) as e:
                logger.warning(f"Không thể parse dòng: {e}")
                continue

    logger.info(f"Đã parse được {len(grades)} môn học từ transcript")
    return grades


def _safe_parse_float(value: str) -> float | None:
    """Chuyển string thành float an toàn, trả None nếu lỗi."""
    try:
        return float(value.replace(",", ".")) if value else None
    except ValueError:
        return None


def _safe_parse_int(value: str) -> int | None:
    """Chuyển string thành int an toàn, trả None nếu lỗi."""
    try:
        return int(value) if value else None
    except ValueError:
        return None


# =============================================================================
# PUBLIC API
# =============================================================================


def parse_transcript(html_content: str) -> ParsedTranscript:
    """
    Parse toàn bộ file HTML transcript.

    Đây là hàm chính được gọi từ service layer.
    Sử dụng lxml parser cho tốc độ tốt hơn.

    Args:
        html_content: Nội dung file HTML dưới dạng string

    Returns:
        ParsedTranscript object chứa thông tin sinh viên + grades

    Raises:
        ValueError: Nếu không parse được dữ liệu cần thiết
    """
    soup = BeautifulSoup(html_content, "lxml")

    # Extract student info
    student_info = _extract_student_info(soup)
    if not student_info["mssv"]:
        raise ValueError(
            "Không tìm thấy MSSV trong file HTML. "
            "Kiểm tra lại cấu trúc file hoặc chỉnh sửa STUDENT_INFO_SELECTORS."
        )

    # Extract grades
    grades = _extract_grades(soup)

    return ParsedTranscript(
        mssv=student_info["mssv"],
        ho_ten=student_info["ho_ten"] or "Chưa xác định",
        major=student_info["major"] or None,
        grades=grades,
    )
