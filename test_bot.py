import asyncio
from app.db.session import get_sessionmaker
from app.schemas.bot import NormalizedCommand
from app.services.bot.bot_commands import dispatch_command

async def test():
    maker = get_sessionmaker()
    async with maker() as db:
        cmd = NormalizedCommand(platform="discord", platform_user_id="7910", command="tkb", args="=")
        text, img = await dispatch_command(db, cmd)
        print(text)

asyncio.run(test())
