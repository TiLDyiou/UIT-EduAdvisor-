# Admin Import Templates

## 1) Exam schedule (.xlsx)
Header can tim:
- `Mã MH`
- `Tên MH`
- `Mã lớp`
- `Ngày thi`
- `Ca Thi`
- `Phòng Thi`
- `Học kỳ`
- `Năm học`

Ghi chu:
- Co the co dong tieu de/chu thich truoc header.
- Parser tu tim dong header va bo qua dong rong.

## 2) Course offerings (.xlsx)
Header can tim:
- `term_code`
- `course_code`
- `course_name`
- `credits`
- `section_code`
- `day_of_week`
- `start_period`
- `end_period`
- `room`

Ghi chu:
- `course_code` se duoc normalize upper-case.
- `credits` phai > 0.
