package com.idncar.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.idncar.service.QuantProxyService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriBuilder;

import java.net.URI;
import java.util.function.Consumer;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;

@Service
public class QuantProxyServiceImpl implements QuantProxyService {

    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public QuantProxyServiceImpl(
            RestClient.Builder restClientBuilder,
            ObjectMapper objectMapper,
            @Value("${python.service.url:http://localhost:8735}") String pythonServiceUrl
    ) {
        this.restClient = restClientBuilder
                .baseUrl(normalizeBaseUrl(pythonServiceUrl))
                .build();
        this.objectMapper = objectMapper;
    }

    @Override
    public JsonNode getState(String symbol, Integer limit) {
        return get("/api/quant/state", uriBuilder -> {
            if (StringUtils.hasText(symbol)) {
                uriBuilder.queryParam("symbol", symbol);
            }
            if (limit != null && limit > 0) {
                uriBuilder.queryParam("limit", limit);
            }
        });
    }

    @Override
    public JsonNode listStocks() {
        return get("/api/quant/stocks", null);
    }

    @Override
    public JsonNode getWeeklyData(String symbol) {
        return get("/api/quant/weekly-data", uriBuilder -> {
            if (StringUtils.hasText(symbol)) {
                uriBuilder.queryParam("symbol", symbol);
            }
        });
    }

    @Override
    public JsonNode getDatabaseSummary(String symbol) {
        return get("/api/quant/database", uriBuilder -> {
            if (StringUtils.hasText(symbol)) {
                uriBuilder.queryParam("symbol", symbol);
            }
        });
    }

    @Override
    public JsonNode getScreener(
            Integer top,
            Integer maxSymbols,
            String preset,
            Integer minAvgAmountK,
            Integer minLatestAmountK,
            Integer minFloatMarketCapW,
            Integer minTotalMarketCapW,
            Integer minListedDays,
            Boolean excludeSt,
            Boolean excludeBse,
            Boolean excludeSuspended,
            Boolean excludeNonListingStatus,
            Boolean forceRefresh,
            Boolean asyncJob
    ) {
        return get("/api/quant/screener", uriBuilder -> {
            if (top != null && top > 0) {
                uriBuilder.queryParam("top", top);
            }
            if (maxSymbols != null && maxSymbols > 0) {
                uriBuilder.queryParam("max_symbols", maxSymbols);
            }
            if (StringUtils.hasText(preset)) {
                uriBuilder.queryParam("preset", preset);
            }
            if (minAvgAmountK != null && minAvgAmountK >= 0) {
                uriBuilder.queryParam("min_avg_amount_k", minAvgAmountK);
            }
            if (minLatestAmountK != null && minLatestAmountK >= 0) {
                uriBuilder.queryParam("min_latest_amount_k", minLatestAmountK);
            }
            if (minFloatMarketCapW != null && minFloatMarketCapW >= 0) {
                uriBuilder.queryParam("min_float_market_cap_w", minFloatMarketCapW);
            }
            if (minTotalMarketCapW != null && minTotalMarketCapW >= 0) {
                uriBuilder.queryParam("min_total_market_cap_w", minTotalMarketCapW);
            }
            if (minListedDays != null && minListedDays >= 0) {
                uriBuilder.queryParam("min_listed_days", minListedDays);
            }
            if (excludeSt != null) {
                uriBuilder.queryParam("exclude_st", excludeSt);
            }
            if (excludeBse != null) {
                uriBuilder.queryParam("exclude_bse", excludeBse);
            }
            if (excludeSuspended != null) {
                uriBuilder.queryParam("exclude_suspended", excludeSuspended);
            }
            if (excludeNonListingStatus != null) {
                uriBuilder.queryParam("exclude_non_listing_status", excludeNonListingStatus);
            }
            if (forceRefresh != null) {
                uriBuilder.queryParam("force_refresh", forceRefresh);
            }
            if (asyncJob != null) {
                uriBuilder.queryParam("async_job", asyncJob);
            }
        });
    }

    @Override
    public JsonNode startScreenerJob(
            Integer top,
            Integer maxSymbols,
            String preset,
            Integer minAvgAmountK,
            Integer minLatestAmountK,
            Integer minFloatMarketCapW,
            Integer minTotalMarketCapW,
            Integer minListedDays,
            Boolean excludeSt,
            Boolean excludeBse,
            Boolean excludeSuspended,
            Boolean excludeNonListingStatus,
            Boolean forceRefresh
    ) {
        return get("/api/quant/screener/jobs", uriBuilder -> {
            if (top != null && top > 0) {
                uriBuilder.queryParam("top", top);
            }
            if (maxSymbols != null && maxSymbols > 0) {
                uriBuilder.queryParam("max_symbols", maxSymbols);
            }
            if (StringUtils.hasText(preset)) {
                uriBuilder.queryParam("preset", preset);
            }
            if (minAvgAmountK != null && minAvgAmountK >= 0) {
                uriBuilder.queryParam("min_avg_amount_k", minAvgAmountK);
            }
            if (minLatestAmountK != null && minLatestAmountK >= 0) {
                uriBuilder.queryParam("min_latest_amount_k", minLatestAmountK);
            }
            if (minFloatMarketCapW != null && minFloatMarketCapW >= 0) {
                uriBuilder.queryParam("min_float_market_cap_w", minFloatMarketCapW);
            }
            if (minTotalMarketCapW != null && minTotalMarketCapW >= 0) {
                uriBuilder.queryParam("min_total_market_cap_w", minTotalMarketCapW);
            }
            if (minListedDays != null && minListedDays >= 0) {
                uriBuilder.queryParam("min_listed_days", minListedDays);
            }
            if (excludeSt != null) {
                uriBuilder.queryParam("exclude_st", excludeSt);
            }
            if (excludeBse != null) {
                uriBuilder.queryParam("exclude_bse", excludeBse);
            }
            if (excludeSuspended != null) {
                uriBuilder.queryParam("exclude_suspended", excludeSuspended);
            }
            if (excludeNonListingStatus != null) {
                uriBuilder.queryParam("exclude_non_listing_status", excludeNonListingStatus);
            }
            if (forceRefresh != null) {
                uriBuilder.queryParam("force_refresh", forceRefresh);
            }
        });
    }

    @Override
    public JsonNode getScreenerJob(String jobId) {
        return get("/api/quant/screener/jobs/" + jobId, null);
    }

    @Override
    public JsonNode triggerBuy() {
        return post("/api/quant/action/buy");
    }

    @Override
    public JsonNode triggerSell() {
        return post("/api/quant/action/sell");
    }

    @Override
    public JsonNode startAutomation() {
        return post("/api/quant/automation/start");
    }

    @Override
    public JsonNode stopAutomation() {
        return post("/api/quant/automation/stop");
    }

    @Override
    public JsonNode syncAllSupported(
            String startDate,
            String endDate,
            String stockStatuses,
            String fundMarkets,
            String fundStatuses,
            Integer limit
    ) {
        return post("/api/quant/import/all-supported", uriBuilder -> {
            if (StringUtils.hasText(startDate)) {
                uriBuilder.queryParam("start_date", startDate);
            }
            if (StringUtils.hasText(endDate)) {
                uriBuilder.queryParam("end_date", endDate);
            }
            if (StringUtils.hasText(stockStatuses)) {
                uriBuilder.queryParam("stock_statuses", stockStatuses);
            }
            if (StringUtils.hasText(fundMarkets)) {
                uriBuilder.queryParam("fund_markets", fundMarkets);
            }
            if (StringUtils.hasText(fundStatuses)) {
                uriBuilder.queryParam("fund_statuses", fundStatuses);
            }
            if (limit != null && limit > 0) {
                uriBuilder.queryParam("limit", limit);
            }
        });
    }

    @Override
    public JsonNode syncAllAdjFactors(
            String startDate,
            String endDate,
            Integer stockLimit,
            Integer fundLimit
    ) {
        return post("/api/quant/import/all-adj-factors", uriBuilder -> {
            if (StringUtils.hasText(startDate)) {
                uriBuilder.queryParam("start_date", startDate);
            }
            if (StringUtils.hasText(endDate)) {
                uriBuilder.queryParam("end_date", endDate);
            }
            if (stockLimit != null && stockLimit > 0) {
                uriBuilder.queryParam("stock_limit", stockLimit);
            }
            if (fundLimit != null && fundLimit > 0) {
                uriBuilder.queryParam("fund_limit", fundLimit);
            }
        });
    }

    @Override
    public JsonNode syncAllIndices(
            String startDate,
            String endDate,
            String markets,
            Integer limit
    ) {
        return post("/api/quant/import/all-indices", uriBuilder -> {
            if (StringUtils.hasText(startDate)) {
                uriBuilder.queryParam("start_date", startDate);
            }
            if (StringUtils.hasText(endDate)) {
                uriBuilder.queryParam("end_date", endDate);
            }
            if (StringUtils.hasText(markets)) {
                uriBuilder.queryParam("markets", markets);
            }
            if (limit != null && limit > 0) {
                uriBuilder.queryParam("limit", limit);
            }
        });
    }

    @Override
    public JsonNode syncAllFinancials(
            String startDate,
            String endDate,
            String statuses,
            Integer limit
    ) {
        return post("/api/quant/import/all-financials", uriBuilder -> {
            if (StringUtils.hasText(startDate)) {
                uriBuilder.queryParam("start_date", startDate);
            }
            if (StringUtils.hasText(endDate)) {
                uriBuilder.queryParam("end_date", endDate);
            }
            if (StringUtils.hasText(statuses)) {
                uriBuilder.queryParam("statuses", statuses);
            }
            if (limit != null && limit > 0) {
                uriBuilder.queryParam("limit", limit);
            }
        });
    }

    @Override
    public JsonNode syncAllBoards(Integer limit) {
        return post("/api/quant/import/all-boards", uriBuilder -> {
            if (limit != null && limit > 0) {
                uriBuilder.queryParam("limit", limit);
            }
        });
    }

    private JsonNode get(String path, Consumer<UriBuilder> queryCustomizer) {
        try {
            JsonNode response = restClient.get()
                    .uri(uriBuilder -> buildUri(uriBuilder, path, queryCustomizer))
                    .retrieve()
                    .body(JsonNode.class);
            return response == null ? objectMapper.nullNode() : response;
        } catch (RestClientResponseException exception) {
            throw new ResponseStatusException(
                    BAD_GATEWAY,
                    "量化服务请求失败，状态码：" + exception.getStatusCode(),
                    exception
            );
        } catch (RestClientException exception) {
            throw new ResponseStatusException(BAD_GATEWAY, "量化服务当前不可用", exception);
        }
    }

    private JsonNode post(String path) {
        return post(path, null);
    }

    private JsonNode post(String path, Consumer<UriBuilder> queryCustomizer) {
        try {
            JsonNode response = restClient.post()
                    .uri(uriBuilder -> buildUri(uriBuilder, path, queryCustomizer))
                    .retrieve()
                    .body(JsonNode.class);
            return response == null ? objectMapper.nullNode() : response;
        } catch (RestClientResponseException exception) {
            throw new ResponseStatusException(
                    BAD_GATEWAY,
                    "量化服务请求失败，状态码：" + exception.getStatusCode(),
                    exception
            );
        } catch (RestClientException exception) {
            throw new ResponseStatusException(BAD_GATEWAY, "量化服务当前不可用", exception);
        }
    }

    private URI buildUri(UriBuilder uriBuilder, String path, Consumer<UriBuilder> queryCustomizer) {
        UriBuilder builder = uriBuilder.path(path);
        if (queryCustomizer != null) {
            queryCustomizer.accept(builder);
        }
        return builder.build();
    }

    private String normalizeBaseUrl(String baseUrl) {
        if (!StringUtils.hasText(baseUrl)) {
            return "http://localhost:8735";
        }
        return baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }
}
