package com.idncar.api.admin;

import com.idncar.model.dto.QrCodeDto;
import com.idncar.model.dto.QrScanLogDto;
import com.idncar.model.dto.SaveQrCodeRequest;
import com.idncar.service.QrCodeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/qr-codes")
public class AdminQrCodeController {

    @Autowired
    private QrCodeService qrCodeService;

    @GetMapping
    public ResponseEntity<List<QrCodeDto>> getQrCodes(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(qrCodeService.getAdminQrCodes(userId));
    }

    @PostMapping
    public ResponseEntity<QrCodeDto> createQrCode(@RequestAttribute("userId") Long userId,
                                                  @RequestBody SaveQrCodeRequest request) {
        return ResponseEntity.ok(qrCodeService.createQrCode(userId, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<QrCodeDto> updateQrCode(@RequestAttribute("userId") Long userId,
                                                  @PathVariable Long id,
                                                  @RequestBody SaveQrCodeRequest request) {
        return ResponseEntity.ok(qrCodeService.updateQrCode(userId, id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteQrCode(@RequestAttribute("userId") Long userId,
                                             @PathVariable Long id) {
        qrCodeService.deleteQrCode(userId, id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/scan-logs")
    public ResponseEntity<List<QrScanLogDto>> getScanLogs(@RequestAttribute("userId") Long userId,
                                                          @PathVariable Long id,
                                                          @RequestParam(required = false) Integer limit) {
        return ResponseEntity.ok(qrCodeService.getRecentScanLogs(userId, id, limit));
    }
}
