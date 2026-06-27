import asyncio
from app.db.session import get_sessionmaker, init_engine
from app.core.config import get_settings
from app.schemas.bot import NormalizedCommand
from app.services.bot.bot_commands import dispatch_command

async def main():
    settings = get_settings()
    init_engine(settings.database_url)
    maker = get_sessionmaker()
    async with maker() as db:
        # Assuming the linked user from the test DB is present, or we can just try the start command to see if the DB connection is the issue
        cmd = NormalizedCommand(platform="discord", platform_user_id="test", command="/start", args="test")
        res = await dispatch_command(db, cmd)
        print(res)

if __name__ == "__main__":
    asyncio.run(main())
