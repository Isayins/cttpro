from fastapi import APIRouter

from src.api.imports import router as import_router
from src.api.market import router as market_router

router = APIRouter()
router.include_router(market_router)
router.include_router(import_router)

__all__ = ["router"]
