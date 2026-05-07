from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import auth, onboarding, scheduler, student, sync_stream, tracker

router = APIRouter()
router.include_router(onboarding.router)
router.include_router(auth.router)
router.include_router(student.router)
router.include_router(sync_stream.router)
router.include_router(tracker.router)
router.include_router(scheduler.router)
