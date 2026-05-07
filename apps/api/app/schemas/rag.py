from __future__ import annotations

from pydantic import BaseModel, Field


class PolicyRetrieveItem(BaseModel):
    document_id: int
    document_title: str
    tag: str
    effective_year: int
    chunk_index: int
    content: str


class PolicyRetrieveResponse(BaseModel):
    query: str
    items: list[PolicyRetrieveItem]


class PolicyRetrieveRequest(BaseModel):
    query: str = Field(min_length=2, max_length=200)
    limit: int = Field(default=5, ge=1, le=20)
