package com.idncar.api.rps;

import com.idncar.model.dto.CreateRpsTableRequest;
import com.idncar.model.dto.JoinRpsTableRequest;
import com.idncar.model.dto.RpsActionRequest;
import com.idncar.model.dto.RpsTableResponse;
import com.idncar.model.dto.SubmitRpsChoiceRequest;
import com.idncar.service.RockPaperScissorsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/rps")
public class RockPaperScissorsController {

    @Autowired
    private RockPaperScissorsService rockPaperScissorsService;

    @PostMapping("/tables")
    public ResponseEntity<RpsTableResponse> createTable(@RequestBody(required = false) CreateRpsTableRequest request) {
        return ResponseEntity.ok(rockPaperScissorsService.createTable(request));
    }

    @PostMapping("/tables/{code}/join")
    public ResponseEntity<RpsTableResponse> joinTable(@PathVariable String code,
                                                       @RequestBody(required = false) JoinRpsTableRequest request) {
        return ResponseEntity.ok(rockPaperScissorsService.joinTable(code, request));
    }

    @GetMapping("/tables/{code}")
    public ResponseEntity<RpsTableResponse> getTable(@PathVariable String code,
                                                      @RequestHeader(value = "X-Rps-Player-Token", required = false) String playerToken) {
        return ResponseEntity.ok(rockPaperScissorsService.getTable(code, playerToken));
    }

    @PostMapping("/tables/{code}/choice")
    public ResponseEntity<RpsTableResponse> submitChoice(@PathVariable String code,
                                                         @RequestBody SubmitRpsChoiceRequest request) {
        return ResponseEntity.ok(rockPaperScissorsService.submitChoice(code, request.playerToken(), request.choice()));
    }

    @PostMapping("/tables/{code}/next-round")
    public ResponseEntity<RpsTableResponse> nextRound(@PathVariable String code,
                                                       @RequestBody RpsActionRequest request) {
        return ResponseEntity.ok(rockPaperScissorsService.nextRound(code, request.playerToken()));
    }
}
