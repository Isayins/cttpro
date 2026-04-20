package com.idncar.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.idncar.service.QuantProxyService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class QuantProxyServiceImpl implements QuantProxyService {

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DATE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int MAX_CANDLE_LIMIT = 5000;

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @Value("${quant.default-symbol:}")
    private String defaultSymbol;

    @Value("${quant.candle-limit:60}")
    private int candleLimit;

    private volatile boolean automationEnabled = true;
    private volatile String manualOverride;

    public QuantProxyServiceImpl(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public JsonNode getState(String symbol, Integer limit) {
        return objectMapper.valueToTree(buildSnapshot(symbol, limit));
    }

    @Override
    public JsonNode listStocks() {
        String klineSource = buildKlineSource("SELECT ts_code FROM %s");
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT DISTINCT
                    k.ts_code AS symbol,
                    COALESCE(NULLIF(e.csname, ''), NULLIF(e.extname, ''), NULLIF(e.cname, ''), k.ts_code) AS name,
                    e.exchange,
                    e.index_name AS indexName
                FROM (%s) k
                LEFT JOIN stock.etf_info e ON e.ts_code = k.ts_code
                ORDER BY k.ts_code
                """.formatted(klineSource)
        );
        return objectMapper.valueToTree(rows);
    }

    @Override
    public JsonNode getWeeklyData(String symbol) {
        String resolvedSymbol = resolveSymbol(symbol);
        if (resolvedSymbol == null) {
            return objectMapper.valueToTree(Map.of("data", List.of(), "message", "No market data found in stock database"));
        }

        String klineSource = buildKlineSource(
                """
                SELECT
                    ts_code,
                    trade_date,
                    open,
                    high,
                    low,
                    close,
                    vol,
                    amount,
                    pre_close,
                    pct_chg
                FROM %s
                """
        );
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT
                    ts_code,
                    trade_date,
                    open,
                    high,
                    low,
                    close,
                    vol,
                    amount,
                    pre_close,
                    pct_chg
                FROM (%s) k
                WHERE ts_code = ?
                ORDER BY trade_date DESC
                LIMIT 7
                """.formatted(klineSource),
                resolvedSymbol
        );
        Collections.reverse(rows);

        List<Map<String, Object>> data = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("symbol", asString(row.get("ts_code")));
            item.put("date", formatDate(row.get("trade_date")));
            item.put("open", toDouble(row.get("open"), 4));
            item.put("high", toDouble(row.get("high"), 4));
            item.put("low", toDouble(row.get("low"), 4));
            item.put("close", toDouble(row.get("close"), 4));
            item.put("volume", toLong(row.get("vol")));
            item.put("amount", toDouble(row.get("amount"), 2));
            item.put("indicator1", toDouble(row.get("pre_close"), 4));
            item.put("indicator2", toDouble(row.get("pct_chg"), 4));
            data.add(item);
        }
        return objectMapper.valueToTree(Map.of("data", data));
    }

    @Override
    public JsonNode triggerBuy() {
        manualOverride = "BUY";
        return objectMapper.valueToTree(Map.of("ok", true, "message", "Manual buy signal pushed"));
    }

    @Override
    public JsonNode triggerSell() {
        manualOverride = "SELL";
        return objectMapper.valueToTree(Map.of("ok", true, "message", "Manual sell signal pushed"));
    }

    @Override
    public JsonNode startAutomation() {
        automationEnabled = true;
        manualOverride = null;
        return objectMapper.valueToTree(Map.of("ok", true, "message", "Automation started"));
    }

    @Override
    public JsonNode stopAutomation() {
        automationEnabled = false;
        return objectMapper.valueToTree(Map.of("ok", true, "message", "Automation paused"));
    }

    private Map<String, Object> buildSnapshot(String symbol, Integer limit) {
        try {
            String resolvedSymbol = resolveSymbol(symbol);
            if (resolvedSymbol == null) {
                return emptySnapshot("No market data found in stock database");
            }

            List<Map<String, Object>> rows = loadRows(resolvedSymbol, resolveLimit(limit));
            if (rows.isEmpty()) {
                return emptySnapshot("No kline data found for " + resolvedSymbol);
            }

            Map<String, Object> latest = rows.get(rows.size() - 1);
            Map<String, Object> previous = rows.size() > 1 ? rows.get(rows.size() - 2) : latest;
            String name = asString(latest.get("name"));
            if (name == null || name.isBlank()) {
                name = resolvedSymbol;
            }

            double pctChg = toDouble(latest.get("pct_chg"), 4);
            if (pctChg == 0.0d) {
                double previousClose = toDouble(previous.get("close"), 4);
                if (previousClose > 0) {
                    pctChg = round((toDouble(latest.get("close"), 4) - previousClose) / previousClose * 100, 2);
                }
            }

            List<Map<String, Object>> candles = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                Map<String, Object> candle = new LinkedHashMap<>();
                candle.put("time", formatDate(row.get("trade_date")));
                candle.put("open", toDouble(row.get("open"), 4));
                candle.put("high", toDouble(row.get("high"), 4));
                candle.put("low", toDouble(row.get("low"), 4));
                candle.put("close", toDouble(row.get("close"), 4));
                candle.put("volume", toLong(row.get("vol")));
                candle.put("amount", toDouble(row.get("amount"), 2));
                candles.add(candle);
            }

            List<Map<String, Object>> equity = buildEquity(rows);
            Map<String, Object> signal = buildSignal(rows, resolvedSymbol, name);

            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("nav", equity.isEmpty() ? 0 : equity.get(equity.size() - 1).get("value"));
            summary.put("positionPct", signal.get("positionPct"));
            summary.put("bars", candles.size());

            Map<String, Object> snapshot = new LinkedHashMap<>();
            snapshot.put("updatedAt", LocalDateTime.now().format(DATE_TIME_FORMATTER));
            snapshot.put("symbol", resolvedSymbol);
            snapshot.put("name", name);
            snapshot.put("lastClose", toDouble(latest.get("close"), 4));
            snapshot.put("dailyChangePct", pctChg);
            snapshot.put("latestVolume", toLong(latest.get("vol")));
            snapshot.put("latestAmount", toDouble(latest.get("amount"), 2));
            snapshot.put("signal", signal);
            snapshot.put("candles", candles);
            snapshot.put("equity", equity);
            snapshot.put("summary", summary);
            return snapshot;
        } catch (Exception exception) {
            return emptySnapshot("Failed to load market data: " + exception.getMessage());
        }
    }

    private String resolveSymbol(String symbol) {
        if (symbol != null && !symbol.isBlank()) {
            String requested = queryForSymbol(symbol);
            if (requested != null) {
                return requested;
            }
        }

        if (defaultSymbol != null && !defaultSymbol.isBlank()) {
            String configured = queryForSymbol(defaultSymbol);
            if (configured != null) {
                return configured;
            }
        }

        List<String> symbols = jdbcTemplate.query(
                """
                SELECT k.ts_code
                FROM (%s) k
                ORDER BY k.trade_date DESC, k.ts_code ASC
                LIMIT 1
                """.formatted(buildKlineSource("SELECT ts_code, trade_date FROM %s")),
                (rs, rowNum) -> rs.getString("ts_code")
        );
        return symbols.isEmpty() ? null : symbols.get(0);
    }

    private String queryForSymbol(String symbol) {
        List<String> symbols = jdbcTemplate.query(
                "SELECT ts_code FROM (%s) k WHERE ts_code = ? LIMIT 1".formatted(
                        buildKlineSource("SELECT ts_code FROM %s")
                ),
                (rs, rowNum) -> rs.getString("ts_code"),
                symbol
        );
        return symbols.isEmpty() ? null : symbols.get(0);
    }

    private List<Map<String, Object>> loadRows(String symbol, int limit) {
        String klineSource = buildKlineSource(
                """
                SELECT
                    ts_code,
                    trade_date,
                    open,
                    high,
                    low,
                    close,
                    pre_close,
                    pct_chg,
                    vol,
                    amount
                FROM %s
                """
        );
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                SELECT
                    k.ts_code,
                    k.trade_date,
                    k.open,
                    k.high,
                    k.low,
                    k.close,
                    k.pre_close,
                    k.pct_chg,
                    k.vol,
                    k.amount,
                    COALESCE(NULLIF(e.csname, ''), NULLIF(e.extname, ''), NULLIF(e.cname, ''), k.ts_code) AS name,
                    e.index_name
                FROM (%s) k
                LEFT JOIN stock.etf_info e ON e.ts_code = k.ts_code
                WHERE k.ts_code = ?
                ORDER BY k.trade_date DESC
                LIMIT ?
                """.formatted(klineSource),
                symbol,
                limit
        );
        Collections.reverse(rows);
        return rows;
    }

    private int resolveLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return candleLimit;
        }
        return Math.min(limit, MAX_CANDLE_LIMIT);
    }

    private List<Map<String, Object>> buildEquity(List<Map<String, Object>> rows) {
        List<Map<String, Object>> equity = new ArrayList<>();
        double nav = 1.0d;
        Double previousClose = null;

        for (Map<String, Object> row : rows) {
            double close = toDouble(row.get("close"), 4);
            if (previousClose != null && previousClose > 0) {
                nav *= close / previousClose;
            }
            Map<String, Object> point = new LinkedHashMap<>();
            point.put("date", formatDate(row.get("trade_date")));
            point.put("value", round(nav, 4));
            equity.add(point);
            previousClose = close;
        }
        return equity;
    }

    private Map<String, Object> buildSignal(List<Map<String, Object>> rows, String symbol, String name) {
        if ("BUY".equals(manualOverride)) {
            return signal("FULL", "BUY", symbol, name, 90, "Manual buy signal was triggered.");
        }

        if ("SELL".equals(manualOverride)) {
            return signal("EMPTY", "SELL", symbol, name, 0, "Manual sell signal was triggered.");
        }

        List<Double> closes = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            closes.add(toDouble(row.get("close"), 4));
        }

        Map<String, Object> latest = rows.get(rows.size() - 1);
        double latestClose = closes.get(closes.size() - 1);
        double ma5 = round(averageOfTail(closes, 5), 4);
        double ma10 = round(averageOfTail(closes, 10), 4);
        double pctChg = toDouble(latest.get("pct_chg"), 4);

        Map<String, Object> signal;
        if (latestClose >= ma5 && ma5 >= ma10 && pctChg >= 0) {
            signal = signal("FULL", "BUY", symbol, name, 80, "Price is above the short and mid-term moving averages.");
        } else if (latestClose >= ma10) {
            signal = signal("HALF", "HOLD", symbol, name, 50, "Price is still near the mid-term moving average.");
        } else {
            signal = signal("EMPTY", "SELL", symbol, name, 0, "Price is weaker than the moving average trend.");
        }

        if (!automationEnabled) {
            signal.put("reason", "Automation is paused. " + signal.get("reason"));
        }
        return signal;
    }

    private double averageOfTail(List<Double> values, int length) {
        int size = values.size();
        int start = Math.max(0, size - length);
        double sum = 0;
        for (int index = start; index < size; index++) {
            sum += values.get(index);
        }
        return sum / Math.max(1, size - start);
    }

    private Map<String, Object> signal(String market, String action, String symbol, String name, int positionPct, String reason) {
        Map<String, Object> signal = new LinkedHashMap<>();
        signal.put("market", market);
        signal.put("action", action);
        signal.put("etf", symbol);
        signal.put("name", name);
        signal.put("positionPct", positionPct);
        signal.put("reason", reason);
        return signal;
    }

    private Map<String, Object> emptySnapshot(String error) {
        Map<String, Object> signal = new LinkedHashMap<>();
        signal.put("market", "EMPTY");
        signal.put("action", "HOLD");
        signal.put("etf", null);
        signal.put("name", "");
        signal.put("positionPct", 0);
        signal.put("reason", "No strategy signal available.");

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("nav", 0);
        summary.put("positionPct", 0);
        summary.put("bars", 0);

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("updatedAt", LocalDateTime.now().format(DATE_TIME_FORMATTER));
        snapshot.put("symbol", "");
        snapshot.put("name", "");
        snapshot.put("lastClose", 0);
        snapshot.put("dailyChangePct", 0);
        snapshot.put("latestVolume", 0);
        snapshot.put("latestAmount", 0);
        snapshot.put("signal", signal);
        snapshot.put("candles", List.of());
        snapshot.put("equity", List.of());
        snapshot.put("summary", summary);
        snapshot.put("error", error);
        return snapshot;
    }

    private String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private String formatDate(Object value) {
        if (value instanceof Timestamp timestamp) {
            return timestamp.toLocalDateTime().toLocalDate().format(DATE_FORMATTER);
        }
        if (value instanceof Date date) {
            return date.toLocalDate().format(DATE_FORMATTER);
        }
        if (value instanceof LocalDate localDate) {
            return localDate.format(DATE_FORMATTER);
        }
        return value == null ? "" : String.valueOf(value);
    }

    private double toDouble(Object value, int digits) {
        if (value == null) {
            return 0.0d;
        }
        if (value instanceof BigDecimal decimal) {
            return round(decimal.doubleValue(), digits);
        }
        if (value instanceof Number number) {
            return round(number.doubleValue(), digits);
        }
        return round(Double.parseDouble(String.valueOf(value)), digits);
    }

    private long toLong(Object value) {
        if (value == null) {
            return 0L;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }

    private double round(double value, int digits) {
        return BigDecimal.valueOf(value).setScale(digits, RoundingMode.HALF_UP).doubleValue();
    }

    private String buildKlineSource(String selectTemplate) {
        List<String> tables = listKlineTables();
        if (tables.isEmpty()) {
            throw new IllegalStateException("No stock.klineYY_daily tables found");
        }
        return tables.stream()
                .map(table -> selectTemplate.formatted("stock." + table))
                .collect(Collectors.joining(" UNION ALL "));
    }

    private List<String> listKlineTables() {
        List<String> tables = jdbcTemplate.query(
                """
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'stock'
                  AND table_name REGEXP '^kline[0-9]{2}_daily$'
                ORDER BY table_name
                """,
                (rs, rowNum) -> rs.getString("table_name")
        );
        return tables.stream()
                .filter(this::isSafeTableName)
                .toList();
    }

    private boolean isSafeTableName(String tableName) {
        return tableName != null && tableName.matches("^kline\\d{2}_daily$");
    }
}
