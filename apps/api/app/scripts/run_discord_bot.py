"""Discord bot service: persistent websocket connection via discord.py.

# MOCK_API: If DISCORD_BOT_TOKEN is empty, the bot logs a warning and exits.
# See docs/M7_BOT_INTEGRATION_GUIDE.md for setting up a Discord application.
"""

from __future__ import annotations

import io
import logging

import discord
from discord import app_commands
from discord.ext import commands

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.db.session import get_sessionmaker, init_engine
from app.schemas.bot import NormalizedCommand
from app.services.bot.bot_commands import dispatch_command

logger = logging.getLogger(__name__)


class EduAdvisorBot(commands.Bot):
    def __init__(self, **kwargs):
        intents = discord.Intents.default()
        intents.message_content = True
        super().__init__(command_prefix="/", intents=intents, **kwargs)

    async def setup_hook(self) -> None:
        self.tree.add_command(_tkb)
        self.tree.add_command(_lithi)
        self.tree.add_command(_deadline)
        self.tree.add_command(_dl)
        self.tree.add_command(_gpa)
        self.tree.add_command(_nhacnho)
        self.tree.add_command(_link)
        self.tree.add_command(_help)
        await self.tree.sync()
        logger.info("discord_commands_synced")

    async def on_ready(self) -> None:
        logger.info("discord_bot_ready", extra={"user": str(self.user)})

    async def on_message(self, message: discord.Message) -> None:
        # Ignore bots (including ourselves)
        if message.author.bot:
            return

        # If it's a DM, allow normal text messages without prefix
        if isinstance(message.channel, discord.DMChannel):
            text = message.content.strip()
            parts = text.split(maxsplit=1)
            if parts:
                cmd = parts[0].lower()
                if not cmd.startswith("/"):
                    cmd = "/" + cmd
                args = parts[1] if len(parts) > 1 else ""

                if cmd == "/dl":
                    cmd = "/deadline"

                maker = get_sessionmaker()
                async with maker() as db:
                    normalized = NormalizedCommand(
                        platform="discord",
                        platform_user_id=str(message.author.id),
                        command=cmd,
                        args=args,
                    )
                    text_resp, img_bytes = await dispatch_command(db, normalized)
                
                if img_bytes:
                    file = discord.File(fp=io.BytesIO(img_bytes), filename="tkb.png")
                    await message.channel.send(text_resp, file=file)
                else:
                    await message.channel.send(text_resp)

        # Process other commands normally (like prefix commands if any)
        await super().on_message(message)


async def _run_command(interaction: discord.Interaction, command: str, args: str = "") -> None:
    """Common handler: normalize → dispatch → reply."""
    await interaction.response.defer(ephemeral=True)
    try:
        maker = get_sessionmaker()
        async with maker() as db:
            cmd_obj = NormalizedCommand(
                platform="discord",
                platform_user_id=str(interaction.user.id),
                command=command,
                args=args,
            )
            text_resp, img_bytes = await dispatch_command(db, cmd_obj)
            
        if img_bytes:
            file = discord.File(fp=io.BytesIO(img_bytes), filename="tkb.png")
            await interaction.followup.send(content=text_resp, file=file, ephemeral=True)
        else:
            await interaction.followup.send(content=text_resp, ephemeral=True)
    except Exception as e:
        logger.exception("Error executing discord command")
        await interaction.followup.send(content="Đã có lỗi xảy ra. Vui lòng thử lại sau.", ephemeral=True)


# ---------------------------------------------------------------------------
# Slash commands
# ---------------------------------------------------------------------------


@app_commands.command(name="tkb", description="Xem TKB tuần hoặc ngày cụ thể")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
@app_commands.describe(thu="VD: 4, mai, nay, thu2... (để trống = cả tuần)")
async def _tkb(interaction: discord.Interaction, thu: str = ""):
    await _run_command(interaction, "/tkb", thu)


@app_commands.command(name="lithi", description="Lịch thi 7 ngày tới")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def _lithi(interaction: discord.Interaction):
    await _run_command(interaction, "/lithi")


@app_commands.command(name="deadline", description="Deadline sắp tới")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def _deadline(interaction: discord.Interaction):
    await _run_command(interaction, "/deadline")


@app_commands.command(name="dl", description="Deadline sắp tới (viết tắt của /deadline)")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def _dl(interaction: discord.Interaction):
    await _run_command(interaction, "/deadline")


@app_commands.command(name="gpa", description="GPA tích lũy hiện tại")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def _gpa(interaction: discord.Interaction):
    await _run_command(interaction, "/gpa")


@app_commands.command(name="nhacnho", description="Bật/tắt nhắc nhở (thi|deadline on|off|status)")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
@app_commands.describe(args="VD: thi on, deadline off, status")
async def _nhacnho(interaction: discord.Interaction, args: str = ""):
    await _run_command(interaction, "/nhacnho", args)


@app_commands.command(name="link", description="Liên kết tài khoản với UIT EduAdvisor")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
@app_commands.describe(token="Mã liên kết từ Settings trên web")
async def _link(interaction: discord.Interaction, token: str = ""):
    await _run_command(interaction, "/start", token)


@app_commands.command(name="help", description="Danh sách lệnh")
@app_commands.allowed_installs(guilds=True, users=True)
@app_commands.allowed_contexts(guilds=True, dms=True, private_channels=True)
async def _help(interaction: discord.Interaction):
    await _run_command(interaction, "/help")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    settings = get_settings()
    configure_logging(settings.app_log_level)

    if not settings.discord_bot_token:
        # MOCK_API: bot exits immediately without token -- see docs/M7_BOT_INTEGRATION_GUIDE.md
        logger.warning("discord_bot_no_token: DISCORD_BOT_TOKEN is empty. Exiting.")
        return

    init_engine(settings.database_url)
    bot = EduAdvisorBot()
    bot.run(settings.discord_bot_token, log_handler=None)


if __name__ == "__main__":
    main()
