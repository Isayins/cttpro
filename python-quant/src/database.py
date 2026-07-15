from __future__ import annotations

from contextlib import contextmanager
import math
from typing import Any, Iterator

import pymysql
from pymysql.cursors import DictCursor

from src.config import settings


def _normalize_param_value(value: Any) -> Any:
    if value is None:
        return None

    if isinstance(value, float) and math.isnan(value):
        return None

    text = value.strip() if isinstance(value, str) else None
    if text is not None and text.lower() in {"nan", "nat", "none", "null"}:
        return None

    return value


def _normalize_params(params: tuple[Any, ...] | None) -> tuple[Any, ...] | None:
    if params is None:
        return None
    return tuple(_normalize_param_value(value) for value in params)


def _normalize_params_list(params_list: list[tuple[Any, ...]]) -> list[tuple[Any, ...]]:
    return [_normalize_params(params) or tuple() for params in params_list]


@contextmanager
def get_connection() -> Iterator[pymysql.connections.Connection]:
    connection = pymysql.connect(
        host=settings.db_host,
        port=settings.db_port,
        user=settings.db_user,
        password=settings.db_password,
        database=settings.db_name,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=True,
        connect_timeout=settings.db_connect_timeout_seconds,
        read_timeout=settings.db_read_timeout_seconds,
        write_timeout=settings.db_write_timeout_seconds,
    )
    try:
        yield connection
    finally:
        connection.close()


def fetch_all(sql: str, params: tuple[Any, ...] | None = None) -> list[dict[str, Any]]:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, _normalize_params(params))
            rows = cursor.fetchall()
            return list(rows)


def fetch_one(sql: str, params: tuple[Any, ...] | None = None) -> dict[str, Any] | None:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, _normalize_params(params))
            row = cursor.fetchone()
            return dict(row) if row else None


def execute(sql: str, params: tuple[Any, ...] | None = None) -> int:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            return int(cursor.execute(sql, _normalize_params(params)))


def execute_many(sql: str, params_list: list[tuple[Any, ...]]) -> int:
    if not params_list:
        return 0

    with get_connection() as connection:
        with connection.cursor() as cursor:
            return int(cursor.executemany(sql, _normalize_params_list(params_list)))
