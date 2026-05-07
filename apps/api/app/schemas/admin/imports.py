from __future__ import annotations

import uuid

from pydantic import BaseModel


class AdminImportUploadResponse(BaseModel):
    job_id: uuid.UUID
    kind: str
    status: str


class AdminImportApplyResponse(BaseModel):
    job_id: uuid.UUID
    status: str
