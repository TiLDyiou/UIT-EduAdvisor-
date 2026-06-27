from __future__ import annotations

from fastapi import APIRouter

from app.api.v1.admin import audit as admin_audit
from app.api.v1.admin import auth as admin_auth
from app.api.v1.admin import courses as admin_courses
from app.api.v1.admin import curricula as admin_curricula
from app.api.v1.admin import imports as admin_imports
from app.api.v1.admin import jobs as admin_jobs
from app.api.v1.admin import policies as admin_policies
from app.api.v1.admin import resources as admin_resources
from app.api.v1.admin import tooltips as admin_tooltips

router = APIRouter()
router.include_router(admin_auth.router)
router.include_router(admin_auth.me_router)
router.include_router(admin_audit.router)
router.include_router(admin_courses.router)
router.include_router(admin_curricula.router)
router.include_router(admin_jobs.router)
router.include_router(admin_policies.router)
router.include_router(admin_imports.router)
router.include_router(admin_resources.router)
router.include_router(admin_tooltips.router)
