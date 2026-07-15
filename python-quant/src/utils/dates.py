from __future__ import annotations

from datetime import datetime


def normalize_tushare_date(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = value.strip()
    if not cleaned:
        return None

    if cleaned.lower() in {"nan", "nat", "none", "null"}:
        return None

    if len(cleaned) == 8 and cleaned.isdigit():
        return cleaned

    if " " in cleaned:
        cleaned = cleaned.split(" ", 1)[0]

    if "/" in cleaned:
        return datetime.strptime(cleaned, "%Y/%m/%d").strftime("%Y%m%d")

    if "-" in cleaned:
        return datetime.strptime(cleaned, "%Y-%m-%d").strftime("%Y%m%d")

    raise ValueError(f"Unsupported date format: {value}")


def tushare_date_to_db(value: str) -> str:
    normalized = normalize_tushare_date(value)
    if normalized is None:
        raise ValueError("trade_date is required")
    return datetime.strptime(normalized, "%Y%m%d").strftime("%Y-%m-%d")


def trade_year_suffix(value: str) -> str:
    normalized = normalize_tushare_date(value)
    if normalized is None:
        raise ValueError("trade_date is required")
    return normalized[2:4]
