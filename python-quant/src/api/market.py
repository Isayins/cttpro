from __future__ import annotations

import asyncio

from fastapi import APIRouter, HTTPException, WebSocket

from src.services.market import market_runtime

router = APIRouter()


@router.get("/api/state")
@router.get("/api/quant/state")
def get_state(symbol: str | None = None, limit: int | None = None, include_database: bool = True):
    return market_runtime.build_snapshot(symbol, limit, include_database=include_database)


@router.post("/api/action/buy")
@router.post("/api/quant/action/buy")
async def manual_buy():
    return await market_runtime.trigger_buy()


@router.post("/api/action/sell")
@router.post("/api/quant/action/sell")
async def manual_sell():
    return await market_runtime.trigger_sell()


@router.post("/api/automation/start")
@router.post("/api/quant/automation/start")
async def start_automation():
    return await market_runtime.start_automation()


@router.post("/api/automation/stop")
@router.post("/api/quant/automation/stop")
async def stop_automation():
    return await market_runtime.stop_automation()


@router.get("/api/quant/stocks")
def get_stocks():
    return market_runtime.list_stocks()


@router.get("/api/quant/weekly-data")
def get_weekly_data(symbol: str | None = None):
    return market_runtime.list_weekly_data(symbol)


@router.get("/api/quant/database")
def get_database_summary(symbol: str | None = None):
    return market_runtime.build_database_summary(symbol)


@router.get("/api/quant/screener")
async def get_screener(
    top: int | None = None,
    max_symbols: int | None = None,
    preset: str | None = None,
    min_avg_amount_k: int | None = None,
    min_latest_amount_k: int | None = None,
    min_float_market_cap_w: int | None = None,
    min_total_market_cap_w: int | None = None,
    min_listed_days: int | None = None,
    exclude_st: bool | None = None,
    exclude_bse: bool | None = None,
    exclude_suspended: bool | None = None,
    exclude_non_listing_status: bool | None = None,
    force_refresh: bool = False,
    async_job: bool = False,
):
    screener_filters = {
        "preset": preset,
        "min_avg_amount_k": min_avg_amount_k,
        "min_latest_amount_k": min_latest_amount_k,
        "min_float_market_cap_w": min_float_market_cap_w,
        "min_total_market_cap_w": min_total_market_cap_w,
        "min_listed_days": min_listed_days,
        "exclude_st": exclude_st,
        "exclude_bse": exclude_bse,
        "exclude_suspended": exclude_suspended,
        "exclude_non_listing_status": exclude_non_listing_status,
    }

    if async_job:
        job = await market_runtime.start_screener_job(
            top,
            max_symbols,
            force_refresh=force_refresh,
            **screener_filters,
        )
        if job.get("jobId"):
            job["jobUrl"] = f"/api/quant/screener/jobs/{job['jobId']}"
        return job

    return await asyncio.to_thread(
        market_runtime.build_screener,
        top,
        max_symbols,
        force_refresh=force_refresh,
        **screener_filters,
    )


@router.get("/api/quant/screener/jobs")
async def start_screener_job(
    top: int | None = None,
    max_symbols: int | None = None,
    preset: str | None = None,
    min_avg_amount_k: int | None = None,
    min_latest_amount_k: int | None = None,
    min_float_market_cap_w: int | None = None,
    min_total_market_cap_w: int | None = None,
    min_listed_days: int | None = None,
    exclude_st: bool | None = None,
    exclude_bse: bool | None = None,
    exclude_suspended: bool | None = None,
    exclude_non_listing_status: bool | None = None,
    force_refresh: bool = False,
):
    return await market_runtime.start_screener_job(
        top,
        max_symbols,
        force_refresh=force_refresh,
        preset=preset,
        min_avg_amount_k=min_avg_amount_k,
        min_latest_amount_k=min_latest_amount_k,
        min_float_market_cap_w=min_float_market_cap_w,
        min_total_market_cap_w=min_total_market_cap_w,
        min_listed_days=min_listed_days,
        exclude_st=exclude_st,
        exclude_bse=exclude_bse,
        exclude_suspended=exclude_suspended,
        exclude_non_listing_status=exclude_non_listing_status,
    )


@router.get("/api/quant/screener/jobs/{job_id}")
def get_screener_job(job_id: str):
    payload = market_runtime.get_screener_job(job_id)
    if not payload:
        raise HTTPException(status_code=404, detail="筛选任务不存在或已过期")
    return payload


@router.websocket("/ws")
@router.websocket("/api/quant/ws")
async def market_ws(
    websocket: WebSocket,
    symbol: str | None = None,
    limit: int | None = None,
    include_database: bool = True,
):
    await market_runtime.connect(websocket, symbol, limit, include_database=include_database)
