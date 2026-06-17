"""Discord bot service: persistent websocket connection via discord.py.

# MOCK_API: If DISCORD_BOT_TOKEN is empty, the bot logs a warning and exits.
# See docs/M7_BOT_INTEGRATION_GUIDE.md for setting up a Discord application.
"""

from __future__ import annotations

import asyncio
import logging
import uuid

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
        self.tree.add_command(_gpa)
        self.tree.add_command(_nhacnho)
        self.tree.add_command(_link)
        self.tree.add_command(_help)
        await self.tree.sync()
        logger.info("discord_commands_synced")

    async def on_ready(self) -> None:
        logger.info("discord_bot_ready", extra={"user": str(self.user)})


async def _run_command(interaction: discord.Interaction, command: str, args: str = "") -> None:
    """Common handler: normalize → dispatch → reply."""
    maker = get_sessionmaker()
    async with maker() as db:
        cmd = NormalizedCommand(
            platform="discord",
            platform_user_id=str(interaction.user.id),
            command=command,
            args=args,
        )
        response = await dispatch_command(db, cmd)
    await interaction.response.send_message(response, ephemeral=True)


# ---------------------------------------------------------------------------
# Slash commands
# ---------------------------------------------------------------------------

@app_commands.command(name="tkb", description="Xem TKB tuan hoac ngay cu the")
@app_commands.describe(thu="VD: thu2, thu3, ... (de trong = ca tuan)")
async def _tkb(interaction: discord.Interaction, thu: str = ""):
    await _run_command(interaction, "/tkb", thu)


@app_commands.command(name="lithi", description="Lich thi 7 ngay toi")
async def _lithi(interaction: discord.Interaction):
    await _run_command(interaction, "/lithi")


@app_commands.command(name="deadline", description="Deadline sap toi")
async def _deadline(interaction: discord.Interaction):
    await _run_command(interaction, "/deadline")


@app_commands.command(name="gpa", description="GPA tich luy hien tai")
async def _gpa(interaction: discord.Interaction):
    await _run_command(interaction, "/gpa")


@app_commands.command(name="nhacnho", description="Bat/tat nhac nho (thi|deadline on|off|status)")
@app_commands.describe(args="VD: thi on, deadline off, status")
async def _nhacnho(interaction: discord.Interaction, args: str = ""):
    await _run_command(interaction, "/nhacnho", args)


@app_commands.command(name="link", description="Lien ket tai khoan voi UIT EduAdvisor")
@app_commands.describe(token="Ma lien ket tu Settings tren web")
async def _link(interaction: discord.Interaction, token: str = ""):
    await _run_command(interaction, "/start", token)


@app_commands.command(name="help", description="Danh sach lenh")
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
