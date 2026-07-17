package com.idncar.api.admin;

import com.idncar.model.dto.AdminPaymentOrderDto;
import com.idncar.model.dto.AdminPaymentOrderStatsDto;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.OrderSupportRequest;
import com.idncar.model.dto.ResolvePaymentOrderRequest;
import com.idncar.service.AlipayFaceToFacePaymentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/payment-orders")
public class AdminPaymentOrderController {

    @Autowired
    private AlipayFaceToFacePaymentService alipayFaceToFacePaymentService;

    @GetMapping
    public ResponseEntity<PageResultDto<AdminPaymentOrderDto>> getPaymentOrders(
            @RequestAttribute("userId") Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String resourceType,
            @RequestParam(required = false) Boolean hasError,
            @RequestParam(required = false) Boolean hasCoupon,
            @RequestParam(required = false) String supportStatus) {
        return ResponseEntity.ok(alipayFaceToFacePaymentService.getAdminOrders(
                userId, page, size, keyword, status, resourceType, hasError, hasCoupon, supportStatus));
    }

    @GetMapping("/stats")
    public ResponseEntity<AdminPaymentOrderStatsDto> getPaymentOrderStats(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(alipayFaceToFacePaymentService.getAdminOrderStats(userId));
    }

    @PostMapping("/{outTradeNo}/sync")
    public ResponseEntity<AdminPaymentOrderDto> syncPaymentOrder(@RequestAttribute("userId") Long userId,
                                                                 @PathVariable String outTradeNo) {
        return ResponseEntity.ok(alipayFaceToFacePaymentService.adminQuery(userId, outTradeNo));
    }

    @PostMapping("/{outTradeNo}/close")
    public ResponseEntity<AdminPaymentOrderDto> closePaymentOrder(@RequestAttribute("userId") Long userId,
                                                                  @PathVariable String outTradeNo) {
        return ResponseEntity.ok(alipayFaceToFacePaymentService.adminClose(userId, outTradeNo));
    }

    @PostMapping("/{outTradeNo}/manual-confirm")
    public ResponseEntity<AdminPaymentOrderDto> manualConfirmPaymentOrder(@RequestAttribute("userId") Long userId,
                                                                          @PathVariable String outTradeNo,
                                                                          @RequestBody(required = false) ResolvePaymentOrderRequest request) {
        return ResponseEntity.ok(alipayFaceToFacePaymentService.adminManualConfirm(userId, outTradeNo, request));
    }

    @PostMapping("/{outTradeNo}/resend-delivery")
    public ResponseEntity<AdminPaymentOrderDto> resendPaymentOrderDelivery(@RequestAttribute("userId") Long userId,
                                                                           @PathVariable String outTradeNo) {
        return ResponseEntity.ok(alipayFaceToFacePaymentService.adminResendDelivery(userId, outTradeNo));
    }

    @PostMapping("/{outTradeNo}/support/reply")
    public ResponseEntity<AdminPaymentOrderDto> replySupport(@RequestAttribute("userId") Long userId,
                                                              @PathVariable String outTradeNo,
                                                              @RequestBody OrderSupportRequest request) {
        return ResponseEntity.ok(alipayFaceToFacePaymentService.adminReplySupport(userId, outTradeNo, request));
    }

    @PostMapping("/{outTradeNo}/resolve")
    public ResponseEntity<AdminPaymentOrderDto> resolvePaymentOrder(@RequestAttribute("userId") Long userId,
                                                                    @PathVariable String outTradeNo,
                                                                    @RequestBody(required = false) ResolvePaymentOrderRequest request) {
        return ResponseEntity.ok(alipayFaceToFacePaymentService.adminResolve(userId, outTradeNo, request));
    }
}
