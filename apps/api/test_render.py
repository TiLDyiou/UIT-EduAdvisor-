import asyncio
import io
from app.db.session import get_sessionmaker, init_engine
from app.core.config import get_settings
from app.schemas.bot import NormalizedCommand
from app.services.bot.bot_commands import dispatch_command
from app.db.models.bot import BotAccount
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

async def main():
    settings = get_settings()
    init_engine(settings.database_url)
    maker = get_sessionmaker()
    async with maker() as db:
        # Get any linked bot account
        res = await db.execute(select(BotAccount).limit(1))
        account = res.scalar_one_or_none()
        if not account:
            print("No linked account found.")
            return

        cmd = NormalizedCommand(
            platform=account.platform,
            platform_user_id=account.platform_user_id,
            command="/tkb",
            args=""
        )
        try:
            text, img = await dispatch_command(db, cmd)
            print("Text:", text)
            print("Image bytes length:", len(img) if img else 0)
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
