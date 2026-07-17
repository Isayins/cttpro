package com.idncar.api.payment;

import com.idncar.model.dto.AlipayFaceToFacePrecreateRequest;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.PaymentOrderDto;
import com.idncar.model.dto.PreviewProductCouponCodeRequest;
import com.idncar.model.dto.ProductCouponPreviewDto;
import com.idncar.service.AlipayFaceToFacePaymentService;
import com.idncar.service.ProductCouponCodeService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/payments/alipay")
public class AlipayPaymentController {

    private static final Logger log = LoggerFactory.getLogger(AlipayPaymentController.class);

    @Autowired
    private AlipayFaceToFacePaymentService alipayFaceToFacePaymentService;

    @Autowired
    private ProductCouponCodeService productCouponCodeService;

    @PostMapping("/face-to-face/orders")
    public ResponseEntity<PaymentOrderDto> precreate(@RequestAttribute("userId") Long userId,
                                                     @RequestBody AlipayFaceToFacePrecreateRequest request) {
        return ResponseEntity.ok(alipayFaceToFacePaymentService.precreate(userId, request));
    }

    @GetMapping("/orders")
    public ResponseEntity<PageResultDto<PaymentOrderDto>> getOrders(
            @RequestAttribute("userId") Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        return ResponseEntity.ok(alipayFaceToFacePaymentService.getUserOrders(userId, page, size, status, keyword));
    }

    @PostMapping("/product-coupon-codes/preview")
    public ResponseEntity<ProductCouponPreviewDto> previewProductCoupon(@RequestAttribute("userId") Long userId,
                                                                        @RequestBody PreviewProductCouponCodeRequest request) {
        return ResponseEntity.ok(productCouponCodeService.previewProductCoupon(userId, request.getProductId(), request.getCouponCode()));
    }

    @GetMapping("/face-to-face/orders/{outTradeNo}")
    public ResponseEntity<PaymentOrderDto> query(@RequestAttribute("userId") Long userId,
                                                 @PathVariable String outTradeNo) {
        return ResponseEntity.ok(alipayFaceToFacePaymentService.query(userId, outTradeNo));
    }

    @PostMapping("/face-to-face/orders/{outTradeNo}/close")
    public ResponseEntity<PaymentOrderDto> close(@RequestAttribute("userId") Long userId,
                                                 @PathVariable String outTradeNo) {
        return ResponseEntity.ok(alipayFaceToFacePaymentService.close(userId, outTradeNo));
    }

    @PostMapping("/face-to-face/orders/{outTradeNo}/resend-delivery")
    public ResponseEntity<PaymentOrderDto> resendDelivery(@RequestAttribute("userId") Long userId,
                                                           @PathVariable String outTradeNo) {
        return ResponseEntity.ok(alipayFaceToFacePaymentService.resendDelivery(userId, outTradeNo));
    }

    @PostMapping(value = "/notify", produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> notify(HttpServletRequest request) {
        Map<String, String> params = extractRequestParams(request);
        boolean handled = alipayFaceToFacePaymentService.handleNotify(params);
        return ResponseEntity.ok(handled ? "success" : "failure");
    }

    @RequestMapping(value = {"/auth/callback", "/auth/callback/"}, method = {RequestMethod.GET, RequestMethod.POST}, produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> authCallback(HttpServletRequest request) {
        Map<String, String> params = extractRequestParams(request);
        log.info(
                "Alipay auth callback received: appId={}, hasAuthCode={}, hasAppAuthCode={}, hasState={}, keys={}",
                safeLogValue(params.get("app_id")),
                params.containsKey("auth_code"),
                params.containsKey("app_auth_code"),
                params.containsKey("state"),
                params.keySet()
        );
        return ResponseEntity.ok("success");
    }

    private Map<String, String> extractRequestParams(HttpServletRequest request) {
        return request.getParameterMap().entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        entry -> Arrays.stream(entry.getValue()).collect(Collectors.joining(","))
                ));
    }

    private String safeLogValue(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.length() <= 12) {
            return trimmed;
        }
        return trimmed.substring(0, 6) + "..." + trimmed.substring(trimmed.length() - 4);
    }
}
