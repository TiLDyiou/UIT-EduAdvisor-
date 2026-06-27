import asyncio
from app.core.security.vault_transit import VaultTransit
import hvac
import os
async def run():
    v = VaultTransit(hvac.Client(url=os.getenv("VAULT_ADDR", "http://localhost:8200"), token="dev-only-root-token"))
    c1 = await v.encrypt_deterministic(b"24520245")
    c2 = await v.encrypt_deterministic(b"24520245")
    print(f"c1: {c1}")
    print(f"c2: {c2}")
asyncio.run(run())
