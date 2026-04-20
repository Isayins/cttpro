import React, { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { StockItem } from "../types/type";
import { Card, CardContent } from "./ui";

const FAVORITE_SYMBOLS_KEY = "quant.favorite.symbols";
const RECENT_SYMBOLS_KEY = "quant.recent.symbols";

type Props = {
  stocks: StockItem[];
  stocksLoading: boolean;
  stocksError: string;
  activeSymbol: string;
  activeStock: StockItem | null;
  onSelectSymbol: (symbol: string) => void;
};

function readStoredSymbols(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
  } catch {
    return [];
  }
}

function writeStoredSymbols(key: string, symbols: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(symbols));
  } catch {
    // Ignore local persistence failures and keep the page interactive.
  }
}

function highlightText(text: string | undefined, keyword: string) {
  const source = text ?? "";
  const term = keyword.trim();
  if (!source || !term) {
    return source || "--";
  }

  const lowerSource = source.toLowerCase();
  const lowerTerm = term.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let start = 0;
  let index = lowerSource.indexOf(lowerTerm, start);

  while (index !== -1) {
    if (index > start) {
      nodes.push(source.slice(start, index));
    }
    nodes.push(
      <mark key={`${source}-${index}`} className="search-highlight">
        {source.slice(index, index + term.length)}
      </mark>
    );
    start = index + term.length;
    index = lowerSource.indexOf(lowerTerm, start);
  }

  if (start < source.length) {
    nodes.push(source.slice(start));
  }

  return nodes;
}

function toStockMap(stocks: StockItem[]) {
  return new Map(stocks.map((item) => [item.symbol, item]));
}

function buildStockCollection(symbols: string[], stockMap: Map<string, StockItem>, activeSymbol: string) {
  return symbols
    .filter((symbol) => symbol !== activeSymbol)
    .map((symbol) => stockMap.get(symbol))
    .filter((item): item is StockItem => Boolean(item));
}

export default function StockSelectorPanel({
  stocks,
  stocksLoading,
  stocksError,
  activeSymbol,
  activeStock,
  onSelectSymbol,
}: Props) {
  const [keyword, setKeyword] = useState("");
  const [favoriteSymbols, setFavoriteSymbols] = useState<string[]>(() => readStoredSymbols(FAVORITE_SYMBOLS_KEY));
  const [recentSymbols, setRecentSymbols] = useState<string[]>(() => readStoredSymbols(RECENT_SYMBOLS_KEY));
  const deferredKeyword = useDeferredValue(keyword);
  const stockMap = useMemo(() => toStockMap(stocks), [stocks]);
  const isFavorite = activeSymbol ? favoriteSymbols.includes(activeSymbol) : false;
  const hasKeyword = deferredKeyword.trim().length > 0;

  const filteredStocks = useMemo(() => {
    const term = deferredKeyword.trim().toLowerCase();
    if (!term) {
      return [];
    }

    return stocks
      .filter((item) => {
        const symbol = item.symbol?.toLowerCase() ?? "";
        const name = item.name?.toLowerCase() ?? "";
        const indexName = item.indexName?.toLowerCase() ?? "";
        return symbol.includes(term) || name.includes(term) || indexName.includes(term);
      })
      .slice(0, 12);
  }, [deferredKeyword, stocks]);

  const favoriteStocks = useMemo(
    () => buildStockCollection(favoriteSymbols, stockMap, activeSymbol).slice(0, 8),
    [activeSymbol, favoriteSymbols, stockMap]
  );
  const recentStocks = useMemo(
    () => buildStockCollection(recentSymbols, stockMap, activeSymbol).slice(0, 8),
    [activeSymbol, recentSymbols, stockMap]
  );
  const quickBrowseStocks = useMemo(() => {
    const pinned = new Set<string>([activeSymbol, ...favoriteSymbols, ...recentSymbols]);
    return stocks.filter((item) => !pinned.has(item.symbol)).slice(0, 12);
  }, [activeSymbol, favoriteSymbols, recentSymbols, stocks]);

  useEffect(() => {
    writeStoredSymbols(FAVORITE_SYMBOLS_KEY, favoriteSymbols);
  }, [favoriteSymbols]);

  useEffect(() => {
    writeStoredSymbols(RECENT_SYMBOLS_KEY, recentSymbols);
  }, [recentSymbols]);

  useEffect(() => {
    if (!activeSymbol) {
      return;
    }
    setRecentSymbols((previous) => [activeSymbol, ...previous.filter((item) => item !== activeSymbol)].slice(0, 10));
  }, [activeSymbol]);

  const applySymbolSelection = (symbol: string) => {
    onSelectSymbol(symbol);
    setKeyword("");
  };

  const toggleFavorite = (symbol: string) => {
    setFavoriteSymbols((previous) =>
      previous.includes(symbol) ? previous.filter((item) => item !== symbol) : [symbol, ...previous].slice(0, 20)
    );
  };

  return (
    <Card>
      <CardContent className="stock-selector-card">
        <div className="selector-head">
          <div>
            <div className="section-kicker">Symbol Switcher</div>
            <h2 className="section-title">股票搜索与切换</h2>
            <div className="muted">把搜索、自选和最近访问都集中在这里，切换股票名称会更顺手。</div>
          </div>
          <div className="badge selector-badge">{stocks.length} 支股票名称</div>
        </div>

        <div className="stock-search-shell">
          <div className="stock-search-wrap">
            <label className="stock-input-label" htmlFor="stock-search-input">
              搜索股票
            </label>
            <input
              id="stock-search-input"
              className="stock-search-input"
              type="search"
              placeholder="输入股票名称、代码或指数关键词，例如 沪深300 / 510300"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && filteredStocks.length > 0) {
                  event.preventDefault();
                  applySymbolSelection(filteredStocks[0].symbol);
                }
              }}
            />
            <div className="stock-search-tip">按回车可直接切换到第一条搜索结果</div>
          </div>

          <div className="stock-current-card">
            <div className="stock-current-copy">
              <div className="stock-current-label">当前股票名称</div>
              <div className="stock-current-name">{activeStock?.name || "--"}</div>
              <div className="stock-current-meta">
                {activeStock?.symbol || "--"}
                {activeStock?.indexName ? ` · ${activeStock.indexName}` : ""}
                {activeStock?.exchange ? ` · ${activeStock.exchange}` : ""}
              </div>
            </div>
            {activeSymbol ? (
              <button
                type="button"
                className={`favorite-toggle ${isFavorite ? "active" : ""}`}
                onClick={() => toggleFavorite(activeSymbol)}
              >
                {isFavorite ? "已加入自选" : "加入自选"}
              </button>
            ) : null}
          </div>
        </div>

        {stocksError ? <div className="error-text">{stocksError}</div> : null}
        {stocksLoading ? <div className="muted">正在加载股票列表...</div> : null}

        {hasKeyword ? (
          <div className="stock-group">
            <div className="stock-group-head">
              <h3 className="stock-group-title">搜索结果</h3>
              <span className="stock-group-meta">{filteredStocks.length} 支</span>
            </div>
            {filteredStocks.length > 0 ? (
              <div className="stock-chip-grid">
                {filteredStocks.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    className={`stock-chip ${activeSymbol === item.symbol ? "active" : ""}`}
                    onClick={() => applySymbolSelection(item.symbol)}
                  >
                    <span className="stock-chip-name stock-chip-name-strong">
                      {highlightText(item.name || item.symbol, deferredKeyword)}
                    </span>
                    <span className="stock-chip-symbol">{highlightText(item.symbol, deferredKeyword)}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="muted">没有匹配结果，换个名称、代码或指数关键词试试。</div>
            )}
          </div>
        ) : null}

        <div className="stock-groups-grid">
          {favoriteStocks.length > 0 ? (
            <div className="stock-group stock-group-panel">
              <div className="stock-group-head">
                <h3 className="stock-group-title">自选列表</h3>
                <span className="stock-group-meta">{favoriteStocks.length} 支</span>
              </div>
              <div className="stock-chip-grid compact">
                {favoriteStocks.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    className="stock-chip compact"
                    onClick={() => applySymbolSelection(item.symbol)}
                  >
                    <span className="stock-chip-name stock-chip-name-strong">{item.name || item.symbol}</span>
                    <span className="stock-chip-symbol">{item.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {recentStocks.length > 0 ? (
            <div className="stock-group stock-group-panel">
              <div className="stock-group-head">
                <h3 className="stock-group-title">最近访问</h3>
                <span className="stock-group-meta">{recentStocks.length} 支</span>
              </div>
              <div className="stock-chip-grid compact">
                {recentStocks.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    className="stock-chip compact"
                    onClick={() => applySymbolSelection(item.symbol)}
                  >
                    <span className="stock-chip-name stock-chip-name-strong">{item.name || item.symbol}</span>
                    <span className="stock-chip-symbol">{item.symbol}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {quickBrowseStocks.length > 0 ? (
          <div className="stock-group">
            <div className="stock-group-head">
              <h3 className="stock-group-title">快速浏览</h3>
              <span className="stock-group-meta">更多股票</span>
            </div>
            <div className="stock-chip-grid">
              {quickBrowseStocks.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  className={`stock-chip ${activeSymbol === item.symbol ? "active" : ""}`}
                  onClick={() => applySymbolSelection(item.symbol)}
                >
                  <span className="stock-chip-name stock-chip-name-strong">{item.name || item.symbol}</span>
                  <span className="stock-chip-symbol">{item.symbol}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
