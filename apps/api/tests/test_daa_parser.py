from __future__ import annotations

from app.services.daa.parser import parse_login_form


def test_parse_daa_login_form_minimal():
    html = """
    <html><body>
    <form action="/user" method="post" id="user-login">
      <input type="hidden" name="form_build_id" value="fbid" />
      <input type="hidden" name="form_id" value="user_login" />
      <div class="captcha">
        <input type="hidden" name="captcha_sid" value="sid1" />
        <input type="hidden" name="captcha_token" value="tok1" />
        <div class="english-captcha-image"><strong>What is 1+1?</strong><br /></div>
        <input type="text" id="edit-english-captcha-answer" name="english_captcha_answer" />
      </div>
    </form>
    </body></html>
    """
    form = parse_login_form(html, "https://daa.uit.edu.vn/user")
    assert form.form_build_id == "fbid"
    assert form.captcha_sid == "sid1"
    assert form.captcha_answer_field == "english_captcha_answer"
    assert "1+1" in form.question


def test_parse_daa_exam_schedule():
    from datetime import date, time
    from app.services.daa.parser import parse_daa_exam_schedule

    # 1. Empty message HTML
    empty_html = """
    <table class="sticky-table">
     <thead><tr><th>STT</th><th>Mã MH</th><th>Mã lớp</th><th>Ca/Tiết thi</th><th>Thứ thi</th><th>Ngày thi</th><th>Phòng thi</th><th>Ghi chú/Hình thức thi</th> </tr></thead>
     <tbody>
      <tr class="odd"><td colspan="8" class="empty message">Hiện tại bạn lịch thi nào</td> </tr>
     </tbody>
    </table>
    """
    assert parse_daa_exam_schedule(empty_html, lanthi=1, hocky=2, namhoc=2025) == []

    # 2. Valid table HTML
    valid_html = """
    <table class="sticky-table">
     <thead><tr><th>STT</th><th>Mã MH</th><th>Mã lớp</th><th>Ca/Tiết thi</th><th>Thứ thi</th><th>Ngày thi</th><th>Phòng thi</th><th>Ghi chú/Hình thức thi</th> </tr></thead>
     <tbody>
      <tr>
        <td>1</td>
        <td>IT003</td>
        <td>IT003.N11</td>
        <td>Ca 1 (07:30 - 09:30)</td>
        <td>Hai</td>
        <td>05/07/2026</td>
        <td>C301</td>
        <td>Tự luận</td>
      </tr>
      <tr>
        <td>2</td>
        <td>MA003</td>
        <td>MA003.N12</td>
        <td>Ca 3 (13h00)</td>
        <td>Sáu</td>
        <td>08-07-2026</td>
        <td>A205</td>
        <td>Trắc nghiệm</td>
      </tr>
     </tbody>
    </table>
    """
    res = parse_daa_exam_schedule(valid_html, lanthi=2, hocky=2, namhoc=2025)
    assert len(res) == 2
    
    # Exam 1
    assert res[0]["course_code"] == "IT003"
    assert res[0]["term_code"] == "HK2_2025-2026"
    assert res[0]["exam_date"] == date(2026, 7, 5)
    assert res[0]["start_time"] == time(7, 30)
    assert res[0]["end_time"] == time(9, 30)
    assert res[0]["room"] == "C301"
    assert res[0]["kind"] == "Cuối kỳ"

    # Exam 2
    assert res[1]["course_code"] == "MA003"
    assert res[1]["start_time"] == time(13, 30)
    assert res[1]["end_time"] == time(15, 30)
    assert res[1]["room"] == "A205"
    assert res[1]["kind"] == "Cuối kỳ"
