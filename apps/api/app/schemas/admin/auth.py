from __future__ import annotations

import uuid

from pydantic import BaseModel, Field


class AdminLoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=256)
    password: str = Field(min_length=1, max_length=256)


class AdminMeResponse(BaseModel):
    id: uuid.UUID
    email: str
    csrf_token: str
