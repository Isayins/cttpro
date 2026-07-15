from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any


def to_float(value: Any, digits: int = 4) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return round(float(value), digits)
    if isinstance(value, (int, float)):
        return round(float(value), digits)
    return round(float(value), digits)


def to_int(value: Any) -> int:
    if value is None:
        return 0
    if isinstance(value, Decimal):
        return int(value)
    if isinstance(value, (int, float)):
        return int(value)
    return int(float(value))


def format_date(value: Any) -> str:
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    return str(value)
