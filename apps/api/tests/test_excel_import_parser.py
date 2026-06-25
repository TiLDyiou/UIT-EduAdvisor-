from __future__ import annotations

from pathlib import Path

from openpyxl import Workbook

from app.services.excel_import import preview_exam_schedule_xlsx, validate_xlsx_readable


def _build_exam_xlsx(path: Path) -> None:
    wb = Workbook()
    ws = wb.active
    ws.title = "Lich thi"
    ws.append(["TRUONG DH CNTT"])
    ws.append(
        [
            "STT",
            "Mã MH",
            "Tên MH",
            "Mã lớp",
            "Giảng Viên LT",
            "Khoá học",
            "Khoa QL",
            "Ngày thi",
            "Thứ",
            "Ca Thi",
            "Phòng Thi",
            "Số SV",
            "Hệ ĐT",
            "Đợt thi",
            "Lần thi",
            "Học kỳ",
            "Năm học",
        ]
    )
    ws.append(
        [
            1,
            "IT001",
            "Nhap mon CNTT",
            "IT001.Q21",
            "GV A",
            20,
            "CNPM",
            "06-04-2026",
            2,
            2,
            "B1.10",
            35,
            "CQUI",
            1,
            1,
            2,
            2025,
        ]
    )
    wb.save(path)


def test_preview_exam_schedule_xlsx_ok(tmp_path: Path) -> None:
    p = tmp_path / "exam.xlsx"
    _build_exam_xlsx(p)
    validate_xlsx_readable(str(p))
    preview = preview_exam_schedule_xlsx(str(p))
    assert len(preview.errors) == 0
    assert len(preview.ok_rows) == 1
    row = preview.ok_rows[0]
    assert row["course_code"] == "IT001"
    assert row["term_code"] == "2025-2"


def test_validate_xlsx_readable_rejects_bad_file(tmp_path: Path) -> None:
    p = tmp_path / "bad.xlsx"
    p.write_bytes(b"not an xlsx")
    try:
        validate_xlsx_readable(str(p))
        assert False, "expected invalid xlsx"
    except Exception:
        assert True
