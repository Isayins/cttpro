package com.idncar.api.payment;

import com.idncar.service.AlipayFaceToFacePaymentService;
import com.idncar.service.InternalVmqPaymentService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/payments/vmq")
public class VmqPaymentController {

    @Autowired
    private AlipayFaceToFacePaymentService alipayFaceToFacePaymentService;

    @Autowired
    private InternalVmqPaymentService internalVmqPaymentService;

    @RequestMapping(value = {"/notify", "/notify/"}, method = {RequestMethod.GET, RequestMethod.POST}, produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> notify(HttpServletRequest request) {
        boolean handled = alipayFaceToFacePaymentService.handleVmqNotify(extractRequestParams(request));
        return ResponseEntity.ok(handled ? "success" : "error_sign");
    }

    @RequestMapping(value = {"/return", "/return/"}, method = {RequestMethod.GET, RequestMethod.POST}, produces = MediaType.TEXT_PLAIN_VALUE)
    public ResponseEntity<String> returnCallback(HttpServletRequest request) {
        boolean handled = alipayFaceToFacePaymentService.handleVmqNotify(extractRequestParams(request));
        return ResponseEntity.ok(handled ? "success" : "error_sign");
    }

    @RequestMapping(value = {"/getState", "/getState/"}, method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<InternalVmqPaymentService.VmqApiResponse> getState(HttpServletRequest request) {
        return ResponseEntity.ok(internalVmqPaymentService.getState(extractRequestParams(request)));
    }

    @RequestMapping(value = {"/appHeart", "/appHeart/"}, method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<InternalVmqPaymentService.VmqApiResponse> appHeart(HttpServletRequest request) {
        return ResponseEntity.ok(internalVmqPaymentService.appHeart(extractRequestParams(request)));
    }

    @RequestMapping(value = {"/appPush", "/appPush/"}, method = {RequestMethod.GET, RequestMethod.POST})
    public ResponseEntity<InternalVmqPaymentService.VmqApiResponse> appPush(HttpServletRequest request) {
        boolean handled = alipayFaceToFacePaymentService.handleVmqAppPush(extractRequestParams(request));
        return ResponseEntity.ok(handled
                ? InternalVmqPaymentService.VmqApiResponse.success()
                : InternalVmqPaymentService.VmqApiResponse.failure("签名校验不通过"));
    }

    private Map<String, String> extractRequestParams(HttpServletRequest request) {
        return request.getParameterMap().entrySet().stream()
                .collect(Collectors.toMap(
                        Map.Entry::getKey,
                        entry -> Arrays.stream(entry.getValue()).collect(Collectors.joining(","))
                ));
    }
}
