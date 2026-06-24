import asyncio
from fastapi import FastAPI
from fastapi.testclient import TestClient

app = FastAPI()

@app.post("/recommend")
async def recommend(available_course_codes: list[str] | None = None):
    return {"codes": available_course_codes}

client = TestClient(app)
response = client.post("/recommend", json=["IT001", "IT002"])
print(response.status_code)
print(response.json())
