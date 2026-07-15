from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ClientSubscription:
    symbol: str | None = None
    limit: int | None = None
    include_database: bool = True

    @property
    def cache_key(self) -> tuple[str | None, int | None, bool]:
        return (self.symbol, self.limit, self.include_database)
