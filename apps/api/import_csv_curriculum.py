"""Import CTDT from CSV file into the database.

Usage (run inside api container):
    python import_csv_curriculum.py /data/attt_k19.csv "An toàn thông tin" "7480202" 2023 130

Arguments:
    csv_path        Path to the CSV file
    major_name      Name of the major (e.g. "An toàn thông tin")
    major_code      Code of the major (e.g. "7480202")
    effective_year  Year the curriculum takes effect (e.g. 2023)
    total_credits   Total credits for the curriculum (e.g. 130)
"""

from __future__ import annotations

import asyncio
import csv
import sys
from io import StringIO

from sqlalchemy import select

from app.core.config import get_settings
from app.db.models.academic import (
    Course,
    Curriculum,
    CurriculumCourse,
    CurriculumTerm,
)
from app.db.models.core_security import Major
from app.db.session import close_engine, get_sessionmaker, init_engine

# Map CSV "Loại môn học" to DB "kind" field
KIND_MAP = {
    "Môn đại cương": "dai_cuong",
    "Môn cơ sở ngành": "co_so_nganh",
    "Môn chuyên ngành": "chuyen_nganh",
    "Môn tự do": "tu_do",
    "Đồ án, thực tập": "do_an",
}


def parse_csv(csv_path: str):
    """Parse the CSV file into courses list and term assignments.

    Returns:
        courses: list of dicts {code, name, credits, kind, difficulty}
        term_assignments: dict {term_number: [course_code, ...]}
    """
    with open(csv_path, encoding="utf-8-sig") as f:
        content = f.read()

    reader = csv.reader(StringIO(content))
    header = next(reader)  # skip header
    assert header[0].strip().startswith("Mã môn học"), f"Unexpected header: {header}"

    # Part 1: Course list (rows with a code in column 0)
    courses: list[dict] = []
    seen_codes: set[str] = set()

    # Part 2: Term assignments – we detect terms by "Tổng tín chỉ học kỳ X"
    term_assignments: dict[int, list[str]] = {}

    all_rows = list(reader)

    # Find where term assignment data starts.
    # The term section has rows like: code_or_name, name_or_credits, credits_or_difficulty, ...
    # and "Tổng tín chỉ học kỳ N" rows as separators.
    term_start_idx = None
    for i, row in enumerate(all_rows):
        # Look for first "Tổng tín chỉ học kỳ" row
        if any("Tổng tín chỉ học kỳ" in cell for cell in row):
            # The term data starts a few rows before this
            # Find the first row after the course list that looks like term data
            # We'll search backwards from here
            term_start_idx = i
            break

    # Actually, let's use a different approach:
    # Course list = rows with valid code AND not in term section
    # Term section = rows after the last "Đồ án, thực tập" course entry

    # First pass: collect all courses from part 1 (rows 1-~60)
    for row in all_rows:
        if len(row) < 4:
            continue
        code = row[0].strip()
        name = row[1].strip()
        tc = row[2].strip()
        kind_raw = row[3].strip()
        difficulty = row[4].strip() if len(row) > 4 else ""

        # Skip rows without a code or with "Tính riêng"
        if not code or tc == "Tính riêng":
            continue
        # Skip summary rows
        if "Tổng tín chỉ" in name or "Tổng tín chỉ" in code:
            continue
        # Skip rows where code looks like a course name (no uppercase letter pattern)
        if not any(c.isdigit() for c in code):
            continue

        try:
            credits = int(tc)
        except ValueError:
            continue

        kind = KIND_MAP.get(kind_raw, "co_so_nganh")

        if code not in seen_codes:
            courses.append(
                {
                    "code": code,
                    "name": name,
                    "credits": credits,
                    "kind": kind,
                    "difficulty": difficulty or None,
                }
            )
            seen_codes.add(code)

    # Second pass: parse term assignments from the bottom part of the CSV
    # Find all "Tổng tín chỉ học kỳ N" markers to split terms
    term_markers: list[tuple[int, int]] = []  # (row_index, term_number)
    for i, row in enumerate(all_rows):
        for cell in row:
            if "Tổng tín chỉ học kỳ" in cell:
                # Extract term number
                parts = cell.replace("Tổng tín chỉ học kỳ", "").strip().split(",")
                try:
                    term_num = int(parts[0].strip())
                    term_markers.append((i, term_num))
                except ValueError:
                    pass

    if term_markers:
        # Build term assignment ranges
        # First term starts from the row after the course list
        # Find the first row that starts term data
        # (first row before the first term marker that has term-like data)
        first_marker_idx = term_markers[0][0]

        # Walk backwards from first marker to find start of term 1 data
        term_data_start = first_marker_idx
        for i in range(first_marker_idx - 1, -1, -1):
            row = all_rows[i]
            if len(row) >= 2:
                # Check if this row is still part of the course list (has kind column)
                kind_raw = row[3].strip() if len(row) > 3 else ""
                if kind_raw in KIND_MAP and kind_raw != "Đồ án, thực tập":
                    break
                term_data_start = i
            else:
                break

        # Now parse each term's courses
        prev_start = term_data_start
        for marker_idx, term_num in term_markers:
            term_courses: list[str] = []
            for i in range(prev_start, marker_idx):
                row = all_rows[i]
                if len(row) < 2:
                    continue
                code = row[0].strip()
                name = row[1].strip() if len(row) > 1 else ""

                # If has a valid course code, use it
                if code and any(c.isdigit() for c in code) and "Tổng" not in code:
                    if code in seen_codes:
                        term_courses.append(code)
                # If no code but has a name, try to find matching course
                elif not code and name:
                    for c in courses:
                        if c["name"].lower().strip() == name.lower().strip():
                            term_courses.append(c["code"])
                            break
                elif code and not any(c.isdigit() for c in code):
                    # Code column has a name instead
                    search_name = code
                    for c in courses:
                        if c["name"].lower().strip() == search_name.lower().strip():
                            term_courses.append(c["code"])
                            break

            term_assignments[term_num] = term_courses
            prev_start = marker_idx + 1

    return courses, term_assignments


async def import_curriculum(
    csv_path: str,
    major_name: str,
    major_code: str,
    effective_year: int,
    total_credits: int,
) -> None:
    init_engine(get_settings().database_url)
    try:
        maker = get_sessionmaker()
        async with maker() as session:
            # 1. Parse CSV
            courses_data, term_assignments = parse_csv(csv_path)
            print(f"Parsed {len(courses_data)} courses, {len(term_assignments)} terms")
            for t, codes in sorted(term_assignments.items()):
                print(f"  Term {t}: {len(codes)} courses -> {codes}")

            # 2. Find or create major
            res = await session.execute(select(Major).where(Major.code == major_code).limit(1))
            major = res.scalar_one_or_none()
            if major is None:
                major = Major(code=major_code, name=major_name)
                session.add(major)
                await session.flush()
                print(f"Created major: {major_name} ({major_code}) id={major.id}")
            else:
                print(f"Found existing major: {major.name} ({major.code}) id={major.id}")

            # 3. Upsert courses
            code_to_id: dict[str, int] = {}
            for cd in courses_data:
                res = await session.execute(
                    select(Course).where(Course.code == cd["code"]).limit(1)
                )
                existing = res.scalar_one_or_none()
                if existing is None:
                    course = Course(
                        code=cd["code"],
                        name=cd["name"],
                        credits=cd["credits"],
                        kind=cd["kind"],
                        difficulty=cd["difficulty"],
                    )
                    session.add(course)
                    await session.flush()
                    code_to_id[cd["code"]] = course.id
                    print(f"  Created course: {cd['code']} - {cd['name']} ({cd['credits']} TC)")
                else:
                    code_to_id[cd["code"]] = existing.id
                    print(f"  Exists: {cd['code']} - {existing.name} (id={existing.id})")

            # 4. Create curriculum
            curriculum = Curriculum(
                major_id=major.id,
                name=f"CTDT {major_name} K{str(effective_year)[-2:]}",
                effective_year=effective_year,
                total_credits=total_credits,
            )
            session.add(curriculum)
            await session.flush()
            print(f"\nCreated curriculum id={curriculum.id}")

            # 5. Create terms and assign courses
            for term_num, course_codes in sorted(term_assignments.items()):
                term = CurriculumTerm(
                    curriculum_id=curriculum.id,
                    term_number=term_num,
                )
                session.add(term)
                await session.flush()

                for code in course_codes:
                    course_id = code_to_id.get(code)
                    if course_id is None:
                        print(f"  WARNING: course {code} not found in DB, skipping")
                        continue
                    # Determine if required based on course kind
                    course_data = next((c for c in courses_data if c["code"] == code), None)
                    is_required = True
                    if course_data and course_data["kind"] in ("chuyen_nganh", "tu_do"):
                        is_required = False

                    cc = CurriculumCourse(
                        curriculum_term_id=term.id,
                        course_id=course_id,
                        is_required=True,  # default to required, admin can adjust
                    )
                    session.add(cc)

                print(f"  Term {term_num}: assigned {len(course_codes)} courses")

            await session.commit()
            print("\n✅ Import completed successfully!")

    finally:
        await close_engine()


def main():
    if len(sys.argv) < 6:
        print(
            "Usage: python import_csv_curriculum.py <csv_path> <major_name> <major_code> <effective_year> <total_credits>"
        )
        sys.exit(1)

    csv_path = sys.argv[1]
    major_name = sys.argv[2]
    major_code = sys.argv[3]
    effective_year = int(sys.argv[4])
    total_credits = int(sys.argv[5])

    asyncio.run(import_curriculum(csv_path, major_name, major_code, effective_year, total_credits))


if __name__ == "__main__":
    main()
