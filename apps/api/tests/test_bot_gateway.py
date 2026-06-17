"""Tests for bot gateway webhook parsing."""

from __future__ import annotations

from app.api.v1.bot_gateway import _parse_telegram_update, _parse_messenger_events


class TestParseTelegramUpdate:
    def test_simple_command(self):
        payload = {"message": {"text": "/tkb", "chat": {"id": 123}}}
        cmd = _parse_telegram_update(payload)
        assert cmd is not None
        assert cmd.command == "/tkb"
        assert cmd.args == ""
        assert cmd.platform_user_id == "123"

    def test_command_with_args(self):
        payload = {"message": {"text": "/tkb thu4", "chat": {"id": 456}}}
        cmd = _parse_telegram_update(payload)
        assert cmd is not None
        assert cmd.command == "/tkb"
        assert cmd.args == "thu4"

    def test_command_with_bot_mention(self):
        payload = {"message": {"text": "/help@MyBot", "chat": {"id": 789}}}
        cmd = _parse_telegram_update(payload)
        assert cmd is not None
        assert cmd.command == "/help"

    def test_no_message(self):
        payload = {"update_id": 1}
        cmd = _parse_telegram_update(payload)
        assert cmd is None

    def test_non_command_text(self):
        payload = {"message": {"text": "hello", "chat": {"id": 100}}}
        cmd = _parse_telegram_update(payload)
        assert cmd is None

    def test_start_with_token(self):
        token = "abc-def-123"
        payload = {"message": {"text": f"/start {token}", "chat": {"id": 200}}}
        cmd = _parse_telegram_update(payload)
        assert cmd is not None
        assert cmd.command == "/start"
        assert cmd.args == token


class TestParseMessengerEvents:
    def test_text_command(self):
        payload = {
            "entry": [{
                "messaging": [{
                    "sender": {"id": "m_user_1"},
                    "message": {"text": "/gpa"},
                }]
            }]
        }
        cmds = _parse_messenger_events(payload)
        assert len(cmds) == 1
        assert cmds[0].command == "/gpa"
        assert cmds[0].platform == "messenger"

    def test_optin_ref(self):
        payload = {
            "entry": [{
                "messaging": [{
                    "sender": {"id": "m_user_2"},
                    "optin": {"ref": "my-link-token"},
                }]
            }]
        }
        cmds = _parse_messenger_events(payload)
        assert len(cmds) == 1
        assert cmds[0].command == "/start"
        assert cmds[0].args == "my-link-token"

    def test_postback(self):
        payload = {
            "entry": [{
                "messaging": [{
                    "sender": {"id": "m_user_3"},
                    "postback": {"payload": "/lithi"},
                }]
            }]
        }
        cmds = _parse_messenger_events(payload)
        assert len(cmds) == 1
        assert cmds[0].command == "/lithi"

    def test_empty_entry(self):
        payload = {"entry": []}
        cmds = _parse_messenger_events(payload)
        assert len(cmds) == 0

    def test_non_command_text_ignored(self):
        payload = {
            "entry": [{
                "messaging": [{
                    "sender": {"id": "m_user_4"},
                    "message": {"text": "hello"},
                }]
            }]
        }
        cmds = _parse_messenger_events(payload)
        assert len(cmds) == 0
