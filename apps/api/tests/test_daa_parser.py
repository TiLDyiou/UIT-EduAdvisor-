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
