import { useDeferredValue, useEffect, useMemo, useState } from "react";
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
    // Keep the selector interactive even when local storage is unavailable.
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

function getSecurityTypeLabel(type?: string | null) {
  if (type === "fund") {
    return "基金";
  }
  if (type === "stock") {
    return "股票";
  }
  if (type === "index") {
    return "指数";
  }
  return type || "";
}

function buildStockDescriptor(item: StockItem) {
  return [getSecurityTypeLabel(item.securityType), item.market, item.exchange, item.industry, item.area]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" / ");
}

function buildStockContext(item: StockItem) {
  return [item.indexName, item.boardNames]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" / ");
}

function scoreStockMatch(item: StockItem, term: string) {
  if (!term) {
    return 0;
  }

  const normalizedTerm = term.toLowerCase();
  let score = 0;

  const boost = (value: string | null | undefined, exact: number, startsWith: number, includes: number) => {
    const source = (value || "").trim().toLowerCase();
    if (!source) {
      return;
    }
    if (source === normalizedTerm) {
      score += exact;
      return;
    }
    if (source.startsWith(normalizedTerm)) {
      score += startsWith;
      return;
    }
    if (source.includes(normalizedTerm)) {
      score += includes;
    }
  };

  boost(item.symbol, 120, 80, 40);
  boost(item.name, 110, 72, 34);
  boost(item.market, 42, 26, 16);
  boost(item.exchange, 40, 24, 16);
  boost(item.industry, 38, 22, 14);
  boost(item.indexName, 36, 20, 14);
  boost(item.boardNames, 30, 18, 12);
  boost(item.area, 28, 16, 10);
  boost(item.securityType, 26, 14, 10);

  return score;
}

function renderStockChip(
  item: StockItem,
  activeSymbol: string,
  onSelect: (symbol: string) => void,
  keyword = ""
) {
  const descriptor = buildStockDescriptor(item);
  const context = buildStockContext(item);

  return (
    <button
      key={item.symbol}
      type="button"
      className={`stock-chip ${activeSymbol === item.symbol ? "active" : ""}`}
      onClick={() => onSelect(item.symbol)}
    >
      <span className="stock-chip-name stock-chip-name-strong">{highlightText(item.name || item.symbol, keyword)}</span>
      <span className="stock-chip-symbol">{highlightText(item.symbol, keyword)}</span>
      {descriptor ? <span className="stock-chip-meta">{highlightText(descriptor, keyword)}</span> : null}
      {context ? <span className="stock-chip-meta">{highlightText(context, keyword)}</span> : null}
    </button>
  );
}

function buildFilterOptions(values: Array<string | null | undefined>, formatter?: (value: string) => string) {
  const counts = new Map<string, number>();
  for (const rawValue of values) {
    const value = (rawValue || "").trim();
    if (!value) {
      continue;
    }
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 6)
    .map(([key, count]) => ({
      key,
      label: formatter ? formatter(key) : key,
      count,
    }));
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
  const [activeType, setActiveType] = useState("ALL");
  const [activeMarket, setActiveMarket] = useState("ALL");
  const deferredKeyword = useDeferredValue(keyword);
  const stockMap = useMemo(() => toStockMap(stocks), [stocks]);
  const isFavorite = activeSymbol ? favoriteSymbols.includes(activeSymbol) : false;
  const hasKeyword = deferredKeyword.trim().length > 0;

  const typeOptions = useMemo(
    () => [{ key: "ALL", label: "全部类型", count: stocks.length }, ...buildFilterOptions(stocks.map((item) => item.securityType), getSecurityTypeLabel)],
    [stocks]
  );
  const marketOptions = useMemo(
    () => [{ key: "ALL", label: "全部市场", count: stocks.length }, ...buildFilterOptions(stocks.flatMap((item) => [item.market, item.exchange]))],
    [stocks]
  );

  const filteredUniverse = useMemo(() => {
    return stocks.filter((item) => {
      const matchesType = activeType === "ALL" || (item.securityType || "") === activeType;
      const matchesMarket =
        activeMarket === "ALL" || (item.market || "") === activeMarket || (item.exchange || "") === activeMarket;
      return matchesType && matchesMarket;
    });
  }, [activeMarket, activeType, stocks]);

  const filteredStocks = useMemo(() => {
    const term = deferredKeyword.trim().toLowerCase();
    if (!term) {
      return [];
    }

    return filteredUniverse
      .map((item) => ({ item, score: scoreStockMatch(item, term) }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score || left.item.symbol.localeCompare(right.item.symbol))
      .map((entry) => entry.item)
      .slice(0, 12);
  }, [deferredKeyword, filteredUniverse]);
  const filteredSymbolSet = useMemo(() => new Set(filteredUniverse.map((item) => item.symbol)), [filteredUniverse]);

  const favoriteStocks = useMemo(
    () => buildStockCollection(favoriteSymbols, stockMap, activeSymbol).filter((item) => filteredSymbolSet.has(item.symbol)).slice(0, 8),
    [activeSymbol, favoriteSymbols, filteredSymbolSet, stockMap]
  );
  const recentStocks = useMemo(
    () => buildStockCollection(recentSymbols, stockMap, activeSymbol).filter((item) => filteredSymbolSet.has(item.symbol)).slice(0, 8),
    [activeSymbol, filteredSymbolSet, recentSymbols, stockMap]
  );
  const quickBrowseStocks = useMemo(() => {
    const pinned = new Set<string>([activeSymbol, ...favoriteSymbols, ...recentSymbols]);
    return filteredUniverse.filter((item) => !pinned.has(item.symbol)).slice(0, 12);
  }, [activeSymbol, favoriteSymbols, filteredUniverse, recentSymbols]);

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

  const activeDescriptor = activeStock ? buildStockDescriptor(activeStock) : "";
  const activeContext = activeStock ? buildStockContext(activeStock) : "";
  const hasActiveFilters = hasKeyword || activeType !== "ALL" || activeMarket !== "ALL";
  const clearFilters = () => {
    setKeyword("");
    setActiveType("ALL");
    setActiveMarket("ALL");
  };

  return (
    <Card>
      <CardContent className="stock-selector-card">
        <div className="selector-head">
          <div>
            <div className="section-kicker">股票切换</div>
            <h2 className="section-title">搜索并切换股票</h2>
            <div className="muted">支持按代码、名称、市场、行业、指数归属或板块信息快速搜索，收藏和最近访问会一起保留。</div>
          </div>
          <div className="badge selector-badge">{stocks.length} 只股票</div>
        </div>

        <div className="selector-overview-grid">
          <div className="selector-overview-card">
            <span className="selector-overview-label">当前范围</span>
            <strong className="selector-overview-value">{filteredUniverse.length}</strong>
            <span className="selector-overview-meta">{hasActiveFilters ? "符合当前筛选条件" : "当前可搜索的完整股票范围"}</span>
          </div>
          <div className="selector-overview-card">
            <span className="selector-overview-label">收藏</span>
            <strong className="selector-overview-value">{favoriteSymbols.length}</strong>
            <span className="selector-overview-meta">保存在当前浏览器</span>
          </div>
          <div className="selector-overview-card">
            <span className="selector-overview-label">最近访问</span>
            <strong className="selector-overview-value">{recentSymbols.length}</strong>
            <span className="selector-overview-meta">最近打开过的股票</span>
          </div>
        </div>

        <div className="stock-search-shell">
          <div className="stock-search-wrap">
            <label className="stock-input-label" htmlFor="stock-search-input">
              搜索股票名称
            </label>
            <input
              id="stock-search-input"
              className="stock-search-input"
              type="search"
              placeholder="试试 510300、沪深300、基金、行业或板块名称"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && filteredStocks.length > 0) {
                  event.preventDefault();
                  applySymbolSelection(filteredStocks[0].symbol);
                }
              }}
            />
            <div className="stock-search-tip">按回车可直接跳到第一个搜索结果。</div>

            <div className="selector-filter-summary">
              <div className="selector-filter-pills">
                {hasKeyword ? <span className="selector-filter-pill">搜索：{deferredKeyword.trim()}</span> : null}
                {activeType !== "ALL" ? <span className="selector-filter-pill">类型：{getSecurityTypeLabel(activeType)}</span> : null}
                {activeMarket !== "ALL" ? <span className="selector-filter-pill">市场：{activeMarket}</span> : null}
                {!hasActiveFilters ? <span className="selector-filter-pill muted-state">当前显示全部股票</span> : null}
              </div>
              {hasActiveFilters ? (
                <button type="button" className="filter-clear-button" onClick={clearFilters}>
                  清空筛选
                </button>
              ) : null}
            </div>

            <div className="filter-section">
              <div className="filter-group">
                <span className="filter-group-label">类型</span>
                <div className="filter-chip-row">
                  {typeOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`filter-chip ${activeType === option.key ? "active" : ""}`}
                      onClick={() => setActiveType(option.key)}
                    >
                      {option.label}
                      <span className="filter-chip-count">{option.count}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-group-label">市场</span>
                <div className="filter-chip-row">
                  {marketOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`filter-chip ${activeMarket === option.key ? "active" : ""}`}
                      onClick={() => setActiveMarket(option.key)}
                    >
                      {option.label}
                      <span className="filter-chip-count">{option.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="stock-current-card">
            <div className="stock-current-copy">
              <div className="stock-current-label">当前股票名称</div>
              <div className="stock-current-name">{activeStock?.name || "请选择一只股票"}</div>
              <div className="stock-current-meta">
                {activeStock?.symbol || "--"}
                {activeStock?.indexName ? ` · ${activeStock.indexName}` : ""}
                {activeStock?.exchange ? ` · ${activeStock.exchange}` : ""}
              </div>
              {activeStock ? (
                <>
                  <div className="stock-current-tags">
                    {activeStock.securityType ? (
                      <span className="stock-meta-pill">{getSecurityTypeLabel(activeStock.securityType)}</span>
                    ) : null}
                    {activeStock.market ? <span className="stock-meta-pill">{activeStock.market}</span> : null}
                    {activeStock.listStatus ? <span className="stock-meta-pill">状态 {activeStock.listStatus}</span> : null}
                    {activeStock.boardCount ? <span className="stock-meta-pill">{activeStock.boardCount} 个板块</span> : null}
                  </div>
                  {activeDescriptor ? <div className="stock-current-submeta">{activeDescriptor}</div> : null}
                  {activeContext ? <div className="stock-current-submeta">{activeContext}</div> : null}
                </>
              ) : null}
            </div>
            {activeSymbol ? (
              <button
                type="button"
                className={`favorite-toggle ${isFavorite ? "active" : ""}`}
                onClick={() => toggleFavorite(activeSymbol)}
              >
                {isFavorite ? "已收藏" : "加入收藏"}
              </button>
            ) : null}
          </div>
        </div>

        {stocksError ? <div className="error-text">{stocksError}</div> : null}
        {stocksLoading ? <div className="muted">正在加载股票列表...</div> : null}
        {!stocksLoading && filteredUniverse.length === 0 ? (
          <div className="selector-empty-state">当前类型和市场筛选下没有可用股票，清空筛选后可回到完整列表。</div>
        ) : null}

        {hasKeyword ? (
          <div className="stock-group">
            <div className="stock-group-head">
              <h3 className="stock-group-title">搜索结果</h3>
              <span className="stock-group-meta">匹配到 {filteredStocks.length} 个</span>
            </div>
            {filteredStocks.length > 0 ? (
              <div className="stock-chip-grid">
                {filteredStocks.map((item) => renderStockChip(item, activeSymbol, applySymbolSelection, deferredKeyword))}
              </div>
            ) : (
              <div className="muted">没有匹配结果，试试换一个代码、市场、行业或板块关键词。</div>
            )}
          </div>
        ) : null}

        <div className="stock-groups-grid">
          {favoriteStocks.length > 0 ? (
            <div className="stock-group stock-group-panel">
              <div className="stock-group-head">
                <h3 className="stock-group-title">收藏</h3>
                <span className="stock-group-meta">{favoriteStocks.length}</span>
              </div>
              <div className="stock-chip-grid compact">
                {favoriteStocks.map((item) => renderStockChip(item, activeSymbol, applySymbolSelection))}
              </div>
            </div>
          ) : null}

          {recentStocks.length > 0 ? (
            <div className="stock-group stock-group-panel">
              <div className="stock-group-head">
                <h3 className="stock-group-title">最近访问</h3>
                <span className="stock-group-meta">{recentStocks.length}</span>
              </div>
              <div className="stock-chip-grid compact">
                {recentStocks.map((item) => renderStockChip(item, activeSymbol, applySymbolSelection))}
              </div>
            </div>
          ) : null}
        </div>

        {quickBrowseStocks.length > 0 ? (
          <div className="stock-group">
            <div className="stock-group-head">
              <h3 className="stock-group-title">快速浏览</h3>
              <span className="stock-group-meta">更多候选股票</span>
            </div>
            <div className="stock-chip-grid">
              {quickBrowseStocks.map((item) => renderStockChip(item, activeSymbol, applySymbolSelection))}
            </div>
          </div>
        ) : hasActiveFilters && filteredUniverse.length > 0 ? (
          <div className="selector-empty-state">当前筛选结果已经被你当前股票名称、收藏和最近访问列表覆盖了。</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
