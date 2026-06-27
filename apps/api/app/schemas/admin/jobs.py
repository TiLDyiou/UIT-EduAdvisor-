from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AdminJobResponse(BaseModel):
    id: uuid.UUID
    kind: str
    status: str
    created_by: uuid.UUID
    current_stage: str | None
    progress_percent: int | None
    error_message: str | None
    result_summary: dict[str, Any] | None
    input_file_path: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None
