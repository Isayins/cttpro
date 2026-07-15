package com.idncar.api.admin;

import com.idncar.model.dto.SaveVmqPaymentSettingsRequest;
import com.idncar.model.dto.VmqPaymentSettingsDto;
import com.idncar.service.InternalVmqPaymentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/payments/vmq")
public class AdminVmqPaymentController {

    @Autowired
    private InternalVmqPaymentService internalVmqPaymentService;

    @GetMapping("/settings")
    public ResponseEntity<VmqPaymentSettingsDto> getSettings(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(internalVmqPaymentService.getAdminSettings(userId));
    }

    @PutMapping("/settings")
    public ResponseEntity<VmqPaymentSettingsDto> saveSettings(@RequestAttribute("userId") Long userId,
                                                              @RequestBody SaveVmqPaymentSettingsRequest request) {
        return ResponseEntity.ok(internalVmqPaymentService.saveAdminSettings(userId, request));
    }

    @PostMapping("/settings/key")
    public ResponseEntity<VmqPaymentSettingsDto> regenerateKey(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(internalVmqPaymentService.regenerateCommunicationKey(userId));
    }
}
