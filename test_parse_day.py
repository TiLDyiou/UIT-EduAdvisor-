import re
from datetime import datetime, timedelta, timezone

_DAY_PARSE = {
    "thu2": 2, "t2": 2, "2": 2,
    "thu3": 3, "t3": 3, "3": 3,
    "thu4": 4, "t4": 4, "4": 4,
    "thu5": 5, "t5": 5, "5": 5,
    "thu6": 6, "t6": 6, "6": 6,
    "thu7": 7, "t7": 7, "7": 7,
    "cn": 8, "chunhat": 8, "8": 8,
}

def _parse_day(arg: str) -> int | None:
    cleaned = re.sub(r"[\s_-]", "", arg.lower())
    
    if cleaned in ("mai", "ngaymai", "tomorrow"):
        now = datetime.now(timezone(timedelta(hours=7)))
        tomorrow = now + timedelta(days=1)
        return (tomorrow.weekday() % 7) + 2
        
    if cleaned in ("nay", "homnay", "today"):
        now = datetime.now(timezone(timedelta(hours=7)))
        return (now.weekday() % 7) + 2
        
    return _DAY_PARSE.get(cleaned)

print(_parse_day("mai"))
