package com.idncar.api.common;

import com.idncar.model.dto.QrCodeAccessRequest;
import com.idncar.model.dto.QrCodeAccessResponse;
import com.idncar.model.dto.QrCodePublicDto;
import com.idncar.service.QrCodeService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/qr-codes")
public class QrCodeController {

    @Autowired
    private QrCodeService qrCodeService;

    @GetMapping("/public/{shortCode}")
    public ResponseEntity<QrCodePublicDto> getPublicQrCode(@PathVariable String shortCode,
                                                           @RequestAttribute(value = "userId", required = false) Long userId) {
        return ResponseEntity.ok(qrCodeService.getPublicQrCode(shortCode, userId));
    }

    @PostMapping("/public/{shortCode}/access")
    public ResponseEntity<QrCodeAccessResponse> accessQrCode(@PathVariable String shortCode,
                                                             @RequestBody(required = false) QrCodeAccessRequest request,
                                                             @RequestAttribute(value = "userId", required = false) Long userId,
                                                             HttpServletRequest httpServletRequest) {
        return ResponseEntity.ok(qrCodeService.accessQrCode(shortCode, request, userId, httpServletRequest));
    }
}
