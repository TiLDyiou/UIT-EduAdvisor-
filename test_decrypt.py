import asyncio
from app.core.security.vault_transit import VaultTransit
import hvac
import os
async def run():
    v = VaultTransit(hvac.Client(url=os.getenv("VAULT_ADDR", "http://localhost:8200"), token="dev-only-root-token"))
    try:
        p = await v.decrypt_deterministic("vault:v1:XE2PzIMepPChFyKgqxQS3Df18GnoaSVduapoTabThvS2CrHj") # 11:59
        print(f"p: '{p.decode()}'")
    except Exception as e:
        print(f"p failed: {e}")
asyncio.run(run())
