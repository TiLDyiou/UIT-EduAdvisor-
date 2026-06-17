from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AdminAuditLogItem(BaseModel):
    id: uuid.UUID
    actor_type: str
    actor_id: uuid.UUID | None
    action: str
    target_type: str
    target_id: str
    payload: dict[str, Any] | None
    ip_address: str | None
    created_at: datetime


class AdminAuditLogListResponse(BaseModel):
    items: list[AdminAuditLogItem]
    total: int
    limit: int
    offset: int
