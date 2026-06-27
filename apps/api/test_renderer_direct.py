import os
from app.services.bot.tkb_renderer import render_tkb
from app.db.models.academic import Schedule, Course

# Create dummy courses
c1 = Course(id=1, code="IT001", name="Nhập môn lập trình")
c2 = Course(id=2, code="SE104", name="Nhập môn Công nghệ phần mềm")
c3 = Course(id=3, code="CS106", name="Trí tuệ nhân tạo")

# Create dummy schedules
s1 = Schedule(
    course=c1,
    day_of_week=2,
    start_period=1,
    end_period=3,
    room="A205",
    week_pattern="123456789"
)
s2 = Schedule(
    course=c2,
    day_of_week=4,
    start_period=6,
    end_period=9,
    room="E102",
    week_pattern="123456789"
)
s3 = Schedule(
    course=c3,
    day_of_week=6,
    start_period=1,
    end_period=5,
    room="B312",
    week_pattern="123456789"
)
s4 = Schedule(
    course=c1,
    day_of_week=3,
    start_period=6,
    end_period=8,
    room="PM11",
    week_pattern="123456789"
)

schedules = [s1, s2, s3, s4]

try:
    img_bytes = render_tkb(schedules)
    print("Render successful, size:", len(img_bytes))
    with open("test_out.png", "wb") as f:
        f.write(img_bytes)
except Exception as e:
    import traceback
    traceback.print_exc()
