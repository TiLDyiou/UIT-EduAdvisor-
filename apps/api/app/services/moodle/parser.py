"""Parse Moodle HTML (login + calendar)."""

from __future__ import annotations

import re
from datetime import datetime
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup


def parse_login_token(html: str) -> str | None:
    soup = BeautifulSoup(html, "html.parser")
    el = soup.select_one('input[name="logintoken"]')
    if el and el.get("value"):
        return str(el["value"])
    return None


def login_failed(html: str) -> bool:
    soup = BeautifulSoup(html, "html.parser")
    return bool(soup.select_one("div.loginerrors, a#loginerrormessage, .alert-danger"))


def parse_upcoming_deadlines(html: str) -> list[dict[str, str | None]]:
    """Parse calendar upcoming view; best-effort."""
    soup = BeautifulSoup(html, "html.parser")
    out: list[dict[str, str | None]] = []
    for event in soup.select(".event"):
        name_el = event.select_one(".eventname a, .name a, a")
        time_el = event.select_one(".date, .time")
        title = name_el.get_text(" ", strip=True) if name_el else None
        when = time_el.get_text(" ", strip=True) if time_el else None
        href = str(name_el["href"]) if name_el and name_el.get("href") else None
        if title:
            out.append({"title": title, "due_text": when, "source_url": href})
    return out


def parse_due_datetime(due_text: str | None) -> datetime | None:
    if not due_text:
        return None
    # Examples: "Monday, 5 May 2026, 11:59 PM" or "5/5/2026"
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    m = re.search(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})", due_text)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            return datetime(y, mo, d, tzinfo=tz)
        except Exception:
            return None
    return None
