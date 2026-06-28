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


def parse_calendar_events_json(data: dict) -> list[dict]:
    """
    Parse Moodle calendar events from core_calendar_get_action_events_by_timesort.
    Tại sao lại dùng eventtype === 'due' thay vì lấy toàn bộ event?
    Trả lời: Trong Moodle, các module (như Assignment, Quiz) sinh ra nhiều loại sự kiện (vd: 'open', 'close', 'due').
    Việc chỉ lọc 'due' giúp đảm bảo chúng ta thu thập chính xác thời hạn nộp bài cuối cùng (deadline),
    loại bỏ các sự kiện rác như thông báo mở bài, đảm bảo dữ liệu hiển thị sạch sẽ và chuẩn xác.
    """
    out = []
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    current_time = int(datetime.now(tz).timestamp())
    
    events = data.get("events", [])
    
    # 1. Filter: eventtype == 'due' and component in ('mod_assign', 'mod_quiz')
    filtered_events = []
    for ev in events:
        if ev.get("eventtype") == "due" and ev.get("component") in ("mod_assign", "mod_quiz"):
            filtered_events.append(ev)
            
    # 2. De-duplication: group by instance, keep the latest timesort
    grouped = {}
    for ev in filtered_events:
        instance = ev.get("instance")
        if not instance:
            continue
        if instance not in grouped:
            grouped[instance] = ev
        else:
            if ev.get("timesort", 0) > grouped[instance].get("timesort", 0):
                grouped[instance] = ev
                
    # 3. Process into clean array
    for ev in grouped.values():
        timesort = ev.get("timesort", 0)
        due_dt = datetime.fromtimestamp(timesort, tz=tz) if timesort > 0 else None
        
        action = ev.get("action", {})
        actionable = action.get("actionable", False)
        
        # Calculate task status
        if due_dt and due_dt.year < datetime.now(tz).year:
            # Bỏ qua các sự kiện từ các năm học trước để tránh hiển thị lỗi "Sắp tới" do nhầm lẫn ngày/tháng
            continue
            
        if not actionable:
            continue
        elif timesort > current_time:
            status = "Cần làm"
        else:
            # Người dùng yêu cầu không hiển thị bài tập quá hạn nữa
            continue
            
        course = ev.get("course", {})
        
        name = ev.get("name", "")
        if name.endswith(" tới hạn"):
            name = name[:-8].strip()
        elif name.endswith(" is due"):
            name = name[:-7].strip()
            
        out.append({
            "id": ev.get("id"),
            "name": name,
            "courseShortName": course.get("shortname", ""),
            "deadline": due_dt,
            "status": status,
            "actionName": action.get("name", ""),
            "actionUrl": action.get("url", "")
        })
        
    return out
