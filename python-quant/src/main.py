from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api import router
from src.config import settings
from src.services.market import market_runtime


@asynccontextmanager
async def lifespan(_: FastAPI):
    await market_runtime.start()
    try:
        yield
    finally:
        await market_runtime.stop()


app = FastAPI(
    title=settings.app_name,
    description="Read ETF market data from the stock database and push it to the frontend.",
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, tags=["market"])


@app.get("/")
def read_root():
    return {"message": "Python stock service is running"}


@app.get("/health")
def health():
    snapshot = market_runtime.build_snapshot()
    return {
        "status": "ok" if not snapshot.get("error") else "degraded",
        "database": settings.db_name,
        "defaultSymbol": settings.default_symbol,
        "error": snapshot.get("error"),
    }
