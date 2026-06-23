from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import ai_mate, auth, bot_gateway, bot_link, gpa_tools, onboarding, policies_public, resync, scheduler, student, sync_stream, tracker
from app.api.v1.admin import router as admin_router
from app.api.v1.admin.tooltips import public_router as public_tooltips_router

router = APIRouter()
router.include_router(onboarding.router)
router.include_router(auth.router)
router.include_router(student.router)
router.include_router(sync_stream.router)
router.include_router(tracker.router)
router.include_router(gpa_tools.router, prefix="/gpa-tools")
router.include_router(resync.router)
router.include_router(admin_router.router)
router.include_router(public_tooltips_router)
router.include_router(policies_public.router)
router.include_router(scheduler.router)
router.include_router(ai_mate.router)
router.include_router(bot_gateway.router)
router.include_router(bot_link.router)

