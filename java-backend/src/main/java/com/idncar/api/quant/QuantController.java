package com.idncar.api.quant;

import com.fasterxml.jackson.databind.JsonNode;
import com.idncar.service.QuantProxyService;
import com.idncar.service.UserAccessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/quant")
public class QuantController {

    @Autowired
    private QuantProxyService quantProxyService;

    @Autowired
    private UserAccessService userAccessService;

    @GetMapping("/state")
    public ResponseEntity<JsonNode> getState(
            @RequestParam(required = false) String symbol,
            @RequestParam(required = false) Integer limit
    ) {
        return ResponseEntity.ok(quantProxyService.getState(symbol, limit));
    }

    @GetMapping("/stocks")
    public ResponseEntity<JsonNode> listStocks() {
        return ResponseEntity.ok(quantProxyService.listStocks());
    }

    @GetMapping("/weekly-data")
    public ResponseEntity<JsonNode> getWeeklyData(@RequestParam(required = false) String symbol) {
        return ResponseEntity.ok(quantProxyService.getWeeklyData(symbol));
    }

    @GetMapping("/database")
    public ResponseEntity<JsonNode> getDatabaseSummary(@RequestParam(required = false) String symbol) {
        return ResponseEntity.ok(quantProxyService.getDatabaseSummary(symbol));
    }

    @GetMapping("/screener")
    public ResponseEntity<JsonNode> getScreener(
            @RequestParam(required = false) Integer top,
            @RequestParam(required = false, name = "max_symbols") Integer maxSymbols,
            @RequestParam(required = false) String preset,
            @RequestParam(required = false, name = "min_avg_amount_k") Integer minAvgAmountK,
            @RequestParam(required = false, name = "min_latest_amount_k") Integer minLatestAmountK,
            @RequestParam(required = false, name = "min_float_market_cap_w") Integer minFloatMarketCapW,
            @RequestParam(required = false, name = "min_total_market_cap_w") Integer minTotalMarketCapW,
            @RequestParam(required = false, name = "min_listed_days") Integer minListedDays,
            @RequestParam(required = false, name = "exclude_st") Boolean excludeSt,
            @RequestParam(required = false, name = "exclude_bse") Boolean excludeBse,
            @RequestParam(required = false, name = "exclude_suspended") Boolean excludeSuspended,
            @RequestParam(required = false, name = "exclude_non_listing_status") Boolean excludeNonListingStatus,
            @RequestParam(required = false, name = "force_refresh") Boolean forceRefresh,
            @RequestParam(required = false, name = "async_job") Boolean asyncJob
    ) {
        return ResponseEntity.ok(
                quantProxyService.getScreener(
                        top,
                        maxSymbols,
                        preset,
                        minAvgAmountK,
                        minLatestAmountK,
                        minFloatMarketCapW,
                        minTotalMarketCapW,
                        minListedDays,
                        excludeSt,
                        excludeBse,
                        excludeSuspended,
                        excludeNonListingStatus,
                        forceRefresh,
                        asyncJob
                )
        );
    }

    @GetMapping("/screener/jobs")
    public ResponseEntity<JsonNode> startScreenerJob(
            @RequestParam(required = false) Integer top,
            @RequestParam(required = false, name = "max_symbols") Integer maxSymbols,
            @RequestParam(required = false) String preset,
            @RequestParam(required = false, name = "min_avg_amount_k") Integer minAvgAmountK,
            @RequestParam(required = false, name = "min_latest_amount_k") Integer minLatestAmountK,
            @RequestParam(required = false, name = "min_float_market_cap_w") Integer minFloatMarketCapW,
            @RequestParam(required = false, name = "min_total_market_cap_w") Integer minTotalMarketCapW,
            @RequestParam(required = false, name = "min_listed_days") Integer minListedDays,
            @RequestParam(required = false, name = "exclude_st") Boolean excludeSt,
            @RequestParam(required = false, name = "exclude_bse") Boolean excludeBse,
            @RequestParam(required = false, name = "exclude_suspended") Boolean excludeSuspended,
            @RequestParam(required = false, name = "exclude_non_listing_status") Boolean excludeNonListingStatus,
            @RequestParam(required = false, name = "force_refresh") Boolean forceRefresh
    ) {
        return ResponseEntity.ok(
                quantProxyService.startScreenerJob(
                        top,
                        maxSymbols,
                        preset,
                        minAvgAmountK,
                        minLatestAmountK,
                        minFloatMarketCapW,
                        minTotalMarketCapW,
                        minListedDays,
                        excludeSt,
                        excludeBse,
                        excludeSuspended,
                        excludeNonListingStatus,
                        forceRefresh
                )
        );
    }

    @GetMapping("/screener/jobs/{jobId}")
    public ResponseEntity<JsonNode> getScreenerJob(@org.springframework.web.bind.annotation.PathVariable("jobId") String jobId) {
        return ResponseEntity.ok(quantProxyService.getScreenerJob(jobId));
    }

    @PostMapping("/action/buy")
    public ResponseEntity<JsonNode> triggerBuy(@RequestAttribute("userId") Long userId) {
        userAccessService.requireAdmin(userId);
        return ResponseEntity.ok(quantProxyService.triggerBuy());
    }

    @PostMapping("/action/sell")
    public ResponseEntity<JsonNode> triggerSell(@RequestAttribute("userId") Long userId) {
        userAccessService.requireAdmin(userId);
        return ResponseEntity.ok(quantProxyService.triggerSell());
    }

    @PostMapping("/automation/start")
    public ResponseEntity<JsonNode> startAutomation(@RequestAttribute("userId") Long userId) {
        userAccessService.requireAdmin(userId);
        return ResponseEntity.ok(quantProxyService.startAutomation());
    }

    @PostMapping("/automation/stop")
    public ResponseEntity<JsonNode> stopAutomation(@RequestAttribute("userId") Long userId) {
        userAccessService.requireAdmin(userId);
        return ResponseEntity.ok(quantProxyService.stopAutomation());
    }

    @PostMapping("/import/all-supported")
    public ResponseEntity<JsonNode> syncAllSupported(
            @RequestAttribute("userId") Long userId,
            @RequestParam(required = false, name = "start_date") String startDate,
            @RequestParam(required = false, name = "end_date") String endDate,
            @RequestParam(required = false, name = "stock_statuses") String stockStatuses,
            @RequestParam(required = false, name = "fund_markets") String fundMarkets,
            @RequestParam(required = false, name = "fund_statuses") String fundStatuses,
            @RequestParam(required = false) Integer limit
    ) {
        userAccessService.requireAdmin(userId);
        return ResponseEntity.ok(
                quantProxyService.syncAllSupported(
                        startDate,
                        endDate,
                        stockStatuses,
                        fundMarkets,
                        fundStatuses,
                        limit
                )
        );
    }

    @PostMapping("/import/all-adj-factors")
    public ResponseEntity<JsonNode> syncAllAdjFactors(
            @RequestAttribute("userId") Long userId,
            @RequestParam(required = false, name = "start_date") String startDate,
            @RequestParam(required = false, name = "end_date") String endDate,
            @RequestParam(required = false, name = "stock_limit") Integer stockLimit,
            @RequestParam(required = false, name = "fund_limit") Integer fundLimit
    ) {
        userAccessService.requireAdmin(userId);
        return ResponseEntity.ok(
                quantProxyService.syncAllAdjFactors(
                        startDate,
                        endDate,
                        stockLimit,
                        fundLimit
                )
        );
    }

    @PostMapping("/import/all-indices")
    public ResponseEntity<JsonNode> syncAllIndices(
            @RequestAttribute("userId") Long userId,
            @RequestParam(required = false, name = "start_date") String startDate,
            @RequestParam(required = false, name = "end_date") String endDate,
            @RequestParam(required = false) String markets,
            @RequestParam(required = false) Integer limit
    ) {
        userAccessService.requireAdmin(userId);
        return ResponseEntity.ok(
                quantProxyService.syncAllIndices(
                        startDate,
                        endDate,
                        markets,
                        limit
                )
        );
    }

    @PostMapping("/import/all-financials")
    public ResponseEntity<JsonNode> syncAllFinancials(
            @RequestAttribute("userId") Long userId,
            @RequestParam(required = false, name = "start_date") String startDate,
            @RequestParam(required = false, name = "end_date") String endDate,
            @RequestParam(required = false) String statuses,
            @RequestParam(required = false) Integer limit
    ) {
        userAccessService.requireAdmin(userId);
        return ResponseEntity.ok(
                quantProxyService.syncAllFinancials(
                        startDate,
                        endDate,
                        statuses,
                        limit
                )
        );
    }

    @PostMapping("/import/all-boards")
    public ResponseEntity<JsonNode> syncAllBoards(
            @RequestAttribute("userId") Long userId,
            @RequestParam(required = false) Integer limit
    ) {
        userAccessService.requireAdmin(userId);
        return ResponseEntity.ok(quantProxyService.syncAllBoards(limit));
    }
}
