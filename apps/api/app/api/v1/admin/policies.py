from __future__ import annotations

import hashlib
import os
import secrets
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.security.audit import record_audit
from app.db.models.core_security import AdminUser
from app.db.models.rag_chat import PolicyDocument
from app.deps import get_current_admin, get_db, get_settings_dep, require_admin_csrf
from app.schemas.admin.jobs import AdminJobResponse
from app.schemas.admin.policies import AdminPolicyListResponse, AdminPolicyResponse, AdminPolicyUploadForm
from app.services.admin_jobs import create_admin_job, to_job_response_dict

router = APIRouter(prefix="/admin/policies", tags=["admin-policies"])

ALLOWED_POLICY_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
ALLOWED_POLICY_EXT = {".pdf", ".docx"}
POLICY_JOB_KIND = "policy_ingest"


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _to_policy_response(row: PolicyDocument) -> AdminPolicyResponse:
    return AdminPolicyResponse(
        id=row.id,
        title=row.title,
        tag=row.tag,
        source_filename=row.source_filename,
        mime_type=row.mime_type,
        file_size_bytes=row.file_size_bytes,
        chunk_count=row.chunk_count,
        ingest_job_id=str(row.ingest_job_id) if row.ingest_job_id else None,
        uploaded_by=str(row.uploaded_by) if row.uploaded_by else None,
        uploaded_at=row.uploaded_at,
        is_deprecated=row.is_deprecated,
        deprecated_at=row.deprecated_at,
    )


async def _ensure_private_dir(path: str) -> Path:
    root = Path(path)
    root.mkdir(parents=True, exist_ok=True)
    return root


@router.post(
    "/upload",
    response_model=AdminJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_admin_csrf)],
)
async def upload_policy(
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
    settings: Annotated[Settings, Depends(get_settings_dep)],
    title: str = Form(...),
    tag: str = Form(...),
    file: UploadFile = File(...),
) -> AdminJobResponse:
    body = AdminPolicyUploadForm(
        title=title,
        tag=tag,
    )
    filename = file.filename or ""
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_POLICY_EXT:
        raise HTTPException(status_code=422, detail={"error": "unsupported_extension"})

    # Browsers often send application/octet-stream for local file picks; allow when ext is valid.
    content_type = (file.content_type or "").split(";")[0].strip()
    allowed_mime = set(ALLOWED_POLICY_MIME)
    if ext in ALLOWED_POLICY_EXT:
        allowed_mime.add("application/octet-stream")
    if content_type and content_type not in allowed_mime:
        raise HTTPException(status_code=422, detail={"error": "unsupported_mime_type"})

    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail={"error": "empty_file"})
    if len(content) > settings.admin_upload_max_file_size_bytes:
        raise HTTPException(status_code=413, detail={"error": "file_too_large"})

    root = await _ensure_private_dir(settings.admin_private_storage_dir)
    safe_name = f"policy_{datetime.now(UTC).strftime('%Y%m%d_%H%M%S')}_{secrets.token_hex(8)}{ext}"
    full_path = root / safe_name
    full_path.write_bytes(content)

    content_hash = hashlib.sha256(content).hexdigest()
    job = await create_admin_job(
        db,
        kind=POLICY_JOB_KIND,
        created_by=admin.id,
        input_file_path=str(full_path),
        result_summary={
            "title": body.title,
            "tag": body.tag,
            "filename": filename,
            "content_hash": content_hash,
        },
    )
    row = PolicyDocument(
        title=body.title,
        tag=body.tag,
        file_path=str(full_path),
        source_filename=filename or None,
        mime_type=content_type or None,
        file_size_bytes=len(content),
        content_hash=content_hash,
        chunk_count=0,
        ingest_job_id=job.id,
        uploaded_by=admin.id,
        uploaded_at=datetime.now(UTC),
        is_deprecated=False,
    )
    db.add(row)
    try:
        await db.flush()
    except IntegrityError as exc:
        try:
            os.remove(full_path)
        except OSError:
            pass
        raise HTTPException(
            status_code=409,
            detail={"error": "policy_version_conflict"},
        ) from exc

    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.policy.uploaded",
        target_type="policy_document",
        target_id=str(row.id),
        payload={"job_id": str(job.id), "tag": row.tag},
        ip_address=_client_ip(request),
    )
    await db.commit()
    return AdminJobResponse.model_validate(to_job_response_dict(job))


@router.get("", response_model=AdminPolicyListResponse)
async def list_policies(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
    tag: str | None = Query(default=None, max_length=32),
    deprecated: bool | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AdminPolicyListResponse:
    query = select(PolicyDocument)
    if tag:
        query = query.where(PolicyDocument.tag == tag.strip().lower())
    if deprecated is not None:
        query = query.where(PolicyDocument.is_deprecated == deprecated)
    total = await db.scalar(select(func.count()).select_from(query.subquery()))
    rows = await db.execute(
        query.order_by(PolicyDocument.id.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [_to_policy_response(r) for r in rows.scalars().all()]
    return AdminPolicyListResponse(items=items, total=total or 0, limit=limit, offset=offset)


@router.get("/{policy_id}", response_model=AdminPolicyResponse)
async def get_policy(
    policy_id: int,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[AdminUser, Depends(get_current_admin)],
) -> AdminPolicyResponse:
    res = await db.execute(select(PolicyDocument).where(PolicyDocument.id == policy_id).limit(1))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="policy_not_found")
    return _to_policy_response(row)


@router.post(
    "/{policy_id}/deprecate",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[Depends(require_admin_csrf)],
)
async def deprecate_policy(
    policy_id: int,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> Response:
    res = await db.execute(select(PolicyDocument).where(PolicyDocument.id == policy_id).limit(1))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="policy_not_found")
    if not row.is_deprecated:
        row.is_deprecated = True
        row.deprecated_at = datetime.now(UTC)
        await record_audit(
            db,
            actor_type="admin",
            actor_id=admin.id,
            action="admin.policy.deprecated",
            target_type="policy_document",
            target_id=str(policy_id),
            payload={"tag": row.tag},
            ip_address=_client_ip(request),
        )
        await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{policy_id}/restore",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[Depends(require_admin_csrf)],
)
async def restore_policy(
    policy_id: int,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> Response:
    res = await db.execute(select(PolicyDocument).where(PolicyDocument.id == policy_id).limit(1))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="policy_not_found")

    # Restore 1 phiên bản -> deprecate các bản active khác cùng tag.
    others = await db.execute(
        select(PolicyDocument).where(
            PolicyDocument.tag == row.tag,
            PolicyDocument.id != row.id,
            PolicyDocument.is_deprecated.is_(False),
        )
    )
    for other in others.scalars().all():
        other.is_deprecated = True
        other.deprecated_at = datetime.now(UTC)

    row.is_deprecated = False
    row.deprecated_at = None
    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.policy.restored",
        target_type="policy_document",
        target_id=str(policy_id),
        payload={"tag": row.tag},
        ip_address=_client_ip(request),
    )
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/{policy_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    dependencies=[Depends(require_admin_csrf)],
)
async def delete_policy(
    policy_id: int,
    request: Request,
    db: Annotated[AsyncSession, Depends(get_db)],
    admin: Annotated[AdminUser, Depends(get_current_admin)],
) -> Response:
    res = await db.execute(select(PolicyDocument).where(PolicyDocument.id == policy_id).limit(1))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="policy_not_found")

    # Core DELETE only: bulk chunk DELETE + ORM delete(instance) can desync session state and break flush.
    file_path = row.file_path
    audit_payload = {"tag": row.tag, "title": row.title}
    await db.execute(delete(PolicyDocument).where(PolicyDocument.id == policy_id))

    await record_audit(
        db,
        actor_type="admin",
        actor_id=admin.id,
        action="admin.policy.deleted",
        target_type="policy_document",
        target_id=str(policy_id),
        payload=audit_payload,
        ip_address=_client_ip(request),
    )
    await db.commit()

    if file_path:
        try:
            os.remove(file_path)
        except OSError:
            pass

    return Response(status_code=status.HTTP_204_NO_CONTENT)
