import json
import pytest
from datetime import datetime
from zoneinfo import ZoneInfo
from app.services.moodle.parser import parse_assignments_json

def test_parse_assignments_json():
    payload = {
        "courses": [
            {
                "id": 15701,
                "fullname": "CVHT l\u1edbp ATTT2024.1",
                "shortname": "ATTT2024.1",
                "assignments": []
            },
            {
                "id": 19556,
                "fullname": "K\u1ef9 n\u0103ng ngh\u1ec1 nghi\u1ec7p - SS004.Q21",
                "shortname": "SS004.Q21",
                "assignments": [
                    {
                        "id": 101083,
                        "name": "B\u00e0i t\u1eadp 1",
                        "duedate": 1770048000,
                        "intro": "<p>Th\u1ef1c hi\u1ec7n b\u00e0i t\u1eadp</p>"
                    }
                ]
            }
        ]
    }
    
    parsed = parse_assignments_json(payload)
    assert len(parsed) == 1
    
    assignment = parsed[0]
    assert assignment["course_name"] == "Kỹ năng nghề nghiệp - SS004.Q21"
    assert assignment["title"] == "Bài tập 1"
    assert assignment["intro"] == "<p>Thực hiện bài tập</p>"
    
    tz = ZoneInfo("Asia/Ho_Chi_Minh")
    assert assignment["due_datetime"] == datetime.fromtimestamp(1770048000, tz=tz)

def test_parse_assignments_json_no_duedate():
    payload = {
        "courses": [
            {
                "fullname": "Course 1",
                "assignments": [
                    {
                        "name": "No deadline",
                        "duedate": 0,
                        "intro": ""
                    }
                ]
            }
        ]
    }
    
    parsed = parse_assignments_json(payload)
    assert len(parsed) == 1
    assert parsed[0]["due_datetime"] is None
