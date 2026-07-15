from __future__ import annotations

import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket, WebSocketDisconnect

from src.config import settings
from src.models.market import ClientSubscription
from src.services.snapshot import snapshot_service
from src.services.tushare_sync import tushare_sync_service


class MarketRuntime:
    def __init__(self) -> None:
        self.clients: dict[WebSocket, ClientSubscription] = {}
        self.refresh_task: asyncio.Task[None] | None = None
        self.last_snapshot_hashes: dict[tuple[str | None, int | None, bool], str] = {}
        self.snapshot_cache: dict[tuple[str | None, int | None, bool, str | None, bool], tuple[float, dict]] = {}
        self.screener_cache: dict[tuple[int | None, int | None, tuple[tuple[str, Any], ...]], tuple[float, dict]] = {}
        self.screener_jobs: dict[str, dict[str, Any]] = {}
        self.screener_jobs_by_key: dict[tuple[int | None, int | None, tuple[tuple[str, Any], ...]], str] = {}
        self.stocks_cache: tuple[float, list[dict]] | None = None
        self.automation_enabled = True
        self.manual_override: str | None = None

    async def start(self) -> None:
        try:
            await asyncio.to_thread(tushare_sync_service.ensure_reference_tables)
        except Exception:
            pass
        if self.refresh_task is None:
            self.refresh_task = asyncio.create_task(self._refresh_loop())

    async def stop(self) -> None:
        if self.refresh_task is not None:
            self.refresh_task.cancel()
            try:
                await self.refresh_task
            except asyncio.CancelledError:
                pass
            self.refresh_task = None

        for websocket in list(self.clients):
            try:
                await websocket.close()
            except Exception:
                pass
        self.clients.clear()
        self.last_snapshot_hashes.clear()
        self.snapshot_cache.clear()
        self.screener_cache.clear()

        pending_job_tasks: list[asyncio.Task[Any]] = []
        for job in self.screener_jobs.values():
            task = job.get("task")
            if task and not task.done():
                task.cancel()
                pending_job_tasks.append(task)
        if pending_job_tasks:
            await asyncio.gather(*pending_job_tasks, return_exceptions=True)

        self.screener_jobs.clear()
        self.screener_jobs_by_key.clear()
        self.stocks_cache = None

    def build_snapshot(
        self,
        symbol: str | None = None,
        limit: int | None = None,
        *,
        include_database: bool = True,
        force_refresh: bool = False,
    ) -> dict:
        cache_key = self._snapshot_cache_key(symbol, limit, include_database)
        if not force_refresh:
            cached = self.snapshot_cache.get(cache_key)
            if cached and cached[0] > time.monotonic():
                return cached[1]

        snapshot = snapshot_service.build_snapshot(
            symbol,
            limit,
            automation_enabled=self.automation_enabled,
            manual_override=self.manual_override,
            include_database=include_database,
        )
        if not snapshot.get("error"):
            expires_at = time.monotonic() + max(1, settings.snapshot_cache_ttl_seconds)
            self.snapshot_cache[cache_key] = (expires_at, snapshot)
        else:
            self.snapshot_cache.pop(cache_key, None)
        self._prune_snapshot_cache()
        return snapshot

    def list_stocks(self) -> list[dict]:
        cached = self.stocks_cache
        if cached and cached[0] > time.monotonic():
            return cached[1]

        rows = snapshot_service.list_stocks()
        ttl_seconds = max(1, settings.stocks_cache_ttl_seconds)
        self.stocks_cache = (time.monotonic() + ttl_seconds, rows)
        return rows

    def list_weekly_data(self, symbol: str | None = None) -> dict:
        return snapshot_service.list_weekly_data(symbol)

    def build_screener(
        self,
        top: int | None = None,
        max_symbols: int | None = None,
        *,
        force_refresh: bool = False,
        **screener_filters: int | bool | str | None,
    ) -> dict:
        cache_key = self._screener_cache_key(top, max_symbols, screener_filters)
        if not force_refresh:
            cached = self.screener_cache.get(cache_key)
            if cached and cached[0] > time.monotonic():
                return cached[1]

        snapshot = snapshot_service.build_screener(top=top, max_symbols=max_symbols, **screener_filters)
        ttl_seconds = settings.screener_cache_ttl_seconds
        if ttl_seconds > 0:
            self.screener_cache[cache_key] = (time.monotonic() + ttl_seconds, snapshot)
        else:
            self.screener_cache.pop(cache_key, None)
        self._prune_screener_cache()
        return snapshot

    async def start_screener_job(
        self,
        top: int | None = None,
        max_symbols: int | None = None,
        *,
        force_refresh: bool = False,
        **screener_filters: int | bool | str | None,
    ) -> dict[str, Any]:
        cache_key = self._screener_cache_key(top, max_symbols, screener_filters)
        self._prune_screener_jobs()

        if not force_refresh:
            cached = self.screener_cache.get(cache_key)
            if cached and cached[0] > time.monotonic():
                now = self._utc_timestamp()
                return self._serialize_screener_job(
                    {
                        "jobId": None,
                        "status": "completed",
                        "createdAt": now,
                        "updatedAt": now,
                        "startedAt": None,
                        "completedAt": now,
                        "error": None,
                        "result": cached[1],
                    },
                    include_result=True,
                    cache_hit=True,
                )

        existing_job_id = self.screener_jobs_by_key.get(cache_key)
        if existing_job_id:
            existing_job = self.screener_jobs.get(existing_job_id)
            if existing_job:
                existing_status = existing_job.get("status")
                if existing_status in {"failed", "cancelled"} or (force_refresh and existing_status == "completed"):
                    self.screener_jobs.pop(existing_job_id, None)
                    self.screener_jobs_by_key.pop(cache_key, None)
                else:
                    return self._serialize_screener_job(
                        existing_job,
                        include_result=existing_status == "completed",
                    )

        created_at = self._utc_timestamp()
        job_id = uuid.uuid4().hex
        job = {
            "jobId": job_id,
            "status": "pending",
            "createdAt": created_at,
            "updatedAt": created_at,
            "startedAt": None,
            "completedAt": None,
            "error": None,
            "result": None,
            "cacheKey": cache_key,
            "expiresAtMonotonic": None,
            "task": None,
        }
        self.screener_jobs[job_id] = job
        self.screener_jobs_by_key[cache_key] = job_id
        job["task"] = asyncio.create_task(
            self._run_screener_job(
                job_id,
                top=top,
                max_symbols=max_symbols,
                force_refresh=force_refresh,
                screener_filters=screener_filters,
            )
        )
        return self._serialize_screener_job(job)

    def get_screener_job(self, job_id: str) -> dict[str, Any] | None:
        self._prune_screener_jobs()
        job = self.screener_jobs.get(job_id)
        if not job:
            return None
        return self._serialize_screener_job(job, include_result=job.get("status") == "completed")

    async def refresh_and_broadcast(self, force: bool = False) -> dict:
        if not self.clients:
            return await asyncio.to_thread(self.build_snapshot, force_refresh=force)

        snapshot_cache: dict[tuple[str | None, int | None, bool], dict] = {}
        stale_clients: list[WebSocket] = []

        for websocket, subscription in list(self.clients.items()):
            key = subscription.cache_key
            snapshot = snapshot_cache.get(key)
            if snapshot is None:
                snapshot = await asyncio.to_thread(
                    self.build_snapshot,
                    subscription.symbol,
                    subscription.limit,
                    include_database=subscription.include_database,
                    force_refresh=force,
                )
                snapshot_cache[key] = snapshot

            snapshot_hash = self._snapshot_material_hash(snapshot)
            if not force and self.last_snapshot_hashes.get(key) == snapshot_hash:
                continue

            self.last_snapshot_hashes[key] = snapshot_hash
            try:
                await websocket.send_json(snapshot)
            except Exception:
                stale_clients.append(websocket)

        for websocket in stale_clients:
            self._remove_client(websocket)

        if snapshot_cache:
            return next(iter(snapshot_cache.values()))
        return await asyncio.to_thread(self.build_snapshot, force_refresh=force)

    async def _refresh_loop(self) -> None:
        while True:
            try:
                await self.refresh_and_broadcast()
            except Exception:
                pass
            await asyncio.sleep(settings.refresh_interval_seconds)

    async def connect(
        self,
        websocket: WebSocket,
        symbol: str | None = None,
        limit: int | None = None,
        include_database: bool = True,
    ) -> None:
        await websocket.accept()
        subscription = ClientSubscription(symbol=symbol, limit=limit, include_database=include_database)
        self.clients[websocket] = subscription
        snapshot = await asyncio.to_thread(self.build_snapshot, symbol, limit, include_database=include_database)
        self.last_snapshot_hashes[subscription.cache_key] = self._snapshot_material_hash(snapshot)
        await websocket.send_json(snapshot)

        try:
            while True:
                await asyncio.sleep(settings.ping_interval_seconds)
                await websocket.send_json({"type": "ping"})
        except WebSocketDisconnect:
            self._remove_client(websocket)
        except Exception:
            self._remove_client(websocket)

    async def trigger_buy(self) -> dict[str, bool | str]:
        self.manual_override = "BUY"
        self.snapshot_cache.clear()
        await self.refresh_and_broadcast(force=True)
        return {"ok": True, "message": "已触发手动买入信号"}

    async def trigger_sell(self) -> dict[str, bool | str]:
        self.manual_override = "SELL"
        self.snapshot_cache.clear()
        await self.refresh_and_broadcast(force=True)
        return {"ok": True, "message": "已触发手动卖出信号"}

    async def start_automation(self) -> dict[str, bool | str]:
        self.automation_enabled = True
        self.manual_override = None
        self.snapshot_cache.clear()
        await self.refresh_and_broadcast(force=True)
        return {"ok": True, "message": "自动化已启动"}

    async def stop_automation(self) -> dict[str, bool | str]:
        self.automation_enabled = False
        self.snapshot_cache.clear()
        await self.refresh_and_broadcast(force=True)
        return {"ok": True, "message": "自动化已暂停"}

    def _snapshot_cache_key(
        self,
        symbol: str | None,
        limit: int | None,
        include_database: bool,
    ) -> tuple[str | None, int | None, bool, str | None, bool]:
        return (symbol, limit, self.automation_enabled, self.manual_override, include_database)

    def build_database_summary(self, symbol: str | None = None) -> dict:
        return snapshot_service.build_database_summary(symbol)

    @staticmethod
    def _screener_cache_key(
        top: int | None,
        max_symbols: int | None,
        screener_filters: dict[str, int | bool | str | None],
    ) -> tuple[int | None, int | None, tuple[tuple[str, Any], ...]]:
        return (
            top,
            max_symbols,
            tuple(sorted(screener_filters.items(), key=lambda item: item[0])),
        )

    def _prune_snapshot_cache(self) -> None:
        now = time.monotonic()
        expired_keys = [key for key, (expires_at, _) in self.snapshot_cache.items() if expires_at <= now]
        for key in expired_keys:
            self.snapshot_cache.pop(key, None)

    def _prune_screener_cache(self) -> None:
        now = time.monotonic()
        expired_keys = [key for key, (expires_at, _) in self.screener_cache.items() if expires_at <= now]
        for key in expired_keys:
            self.screener_cache.pop(key, None)

    async def _run_screener_job(
        self,
        job_id: str,
        *,
        top: int | None,
        max_symbols: int | None,
        force_refresh: bool,
        screener_filters: dict[str, int | bool | str | None],
    ) -> None:
        job = self.screener_jobs.get(job_id)
        if not job:
            return

        started_at = self._utc_timestamp()
        job["status"] = "running"
        job["startedAt"] = started_at
        job["updatedAt"] = started_at

        try:
            snapshot = await asyncio.to_thread(
                self.build_screener,
                top,
                max_symbols,
                force_refresh=force_refresh,
                **screener_filters,
            )
            completed_at = self._utc_timestamp()
            job["status"] = "completed"
            job["updatedAt"] = completed_at
            job["completedAt"] = completed_at
            job["result"] = snapshot
            job["expiresAtMonotonic"] = time.monotonic() + max(30, settings.screener_job_retention_seconds)
            return
        except asyncio.CancelledError:
            cancelled_at = self._utc_timestamp()
            job["status"] = "cancelled"
            job["updatedAt"] = cancelled_at
            job["completedAt"] = cancelled_at
            job["error"] = "筛选任务已取消"
            job["expiresAtMonotonic"] = time.monotonic() + max(30, settings.screener_job_retention_seconds)
            raise
        except Exception as exc:
            failed_at = self._utc_timestamp()
            job["status"] = "failed"
            job["updatedAt"] = failed_at
            job["completedAt"] = failed_at
            job["error"] = str(exc) or "筛选任务执行失败"
            job["expiresAtMonotonic"] = time.monotonic() + max(30, settings.screener_job_retention_seconds)
        finally:
            job["task"] = None

    def _prune_screener_jobs(self) -> None:
        now = time.monotonic()
        stale_job_ids = [
            job_id
            for job_id, job in self.screener_jobs.items()
            if job.get("expiresAtMonotonic") is not None and float(job["expiresAtMonotonic"]) <= now
        ]
        for job_id in stale_job_ids:
            job = self.screener_jobs.pop(job_id, None)
            if not job:
                continue
            cache_key = job.get("cacheKey")
            if cache_key is not None and self.screener_jobs_by_key.get(cache_key) == job_id:
                self.screener_jobs_by_key.pop(cache_key, None)

    def _serialize_screener_job(
        self,
        job: dict[str, Any],
        *,
        include_result: bool = False,
        cache_hit: bool = False,
    ) -> dict[str, Any]:
        payload = {
            "jobId": job.get("jobId"),
            "status": job.get("status"),
            "createdAt": job.get("createdAt"),
            "updatedAt": job.get("updatedAt"),
            "startedAt": job.get("startedAt"),
            "completedAt": job.get("completedAt"),
            "error": job.get("error"),
            "cacheHit": cache_hit,
            "pollAfterMs": max(300, settings.screener_job_poll_interval_ms),
        }
        if include_result:
            payload["result"] = job.get("result")
        return payload

    @staticmethod
    def _utc_timestamp() -> str:
        return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")

    @staticmethod
    def _snapshot_material_hash(snapshot: dict) -> str:
        snapshot_payload = dict(snapshot)
        snapshot_payload.pop("updatedAt", None)
        return json.dumps(snapshot_payload, ensure_ascii=False, sort_keys=True)

    def _remove_client(self, websocket: WebSocket) -> None:
        subscription = self.clients.pop(websocket, None)
        if subscription is None:
            return

        cache_key = subscription.cache_key
        if cache_key not in {item.cache_key for item in self.clients.values()}:
            self.last_snapshot_hashes.pop(cache_key, None)


market_runtime = MarketRuntime()
