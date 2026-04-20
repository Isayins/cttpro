package com.idncar.api.quant;

import com.fasterxml.jackson.databind.JsonNode;
import com.idncar.service.QuantProxyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/quant")
public class QuantController {

    @Autowired
    private QuantProxyService quantProxyService;

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

    @PostMapping("/action/buy")
    public ResponseEntity<JsonNode> triggerBuy() {
        return ResponseEntity.ok(quantProxyService.triggerBuy());
    }

    @PostMapping("/action/sell")
    public ResponseEntity<JsonNode> triggerSell() {
        return ResponseEntity.ok(quantProxyService.triggerSell());
    }

    @PostMapping("/automation/start")
    public ResponseEntity<JsonNode> startAutomation() {
        return ResponseEntity.ok(quantProxyService.startAutomation());
    }

    @PostMapping("/automation/stop")
    public ResponseEntity<JsonNode> stopAutomation() {
        return ResponseEntity.ok(quantProxyService.stopAutomation());
    }
}
