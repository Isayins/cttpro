package com.idncar.service.impl;

import com.alipay.api.AlipayApiException;
import com.alipay.api.AlipayClient;
import com.alipay.api.AlipayConfig;
import com.alipay.api.AlipayRequest;
import com.alipay.api.AlipayResponse;
import com.alipay.api.DefaultAlipayClient;
import com.alipay.api.domain.AlipayTradeCloseModel;
import com.alipay.api.domain.AlipayTradePrecreateModel;
import com.alipay.api.domain.AlipayTradeQueryModel;
import com.alipay.api.internal.util.AlipaySignature;
import com.alipay.api.request.AlipayTradeCloseRequest;
import com.alipay.api.request.AlipayTradePrecreateRequest;
import com.alipay.api.request.AlipayTradeQueryRequest;
import com.alipay.api.response.AlipayTradeCloseResponse;
import com.alipay.api.response.AlipayTradePrecreateResponse;
import com.alipay.api.response.AlipayTradeQueryResponse;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.idncar.config.AlipayPaymentProperties;
import com.idncar.exception.ApiException;
import com.idncar.mapper.AdminOperationLogMapper;
import com.idncar.mapper.PaymentOrderMapper;
import com.idncar.mapper.PaymentVmqEventMapper;
import com.idncar.mapper.ProductMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.AdminPaymentOrderDto;
import com.idncar.model.dto.AdminPaymentOrderStatsDto;
import com.idncar.model.dto.AlipayFaceToFacePrecreateRequest;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.PaymentOrderDto;
import com.idncar.model.dto.ResolvePaymentOrderRequest;
import com.idncar.model.entity.AdminOperationLog;
import com.idncar.model.entity.PaymentOrder;
import com.idncar.model.entity.PaymentVmqEvent;
import com.idncar.model.entity.Product;
import com.idncar.model.entity.ProductCouponCode;
import com.idncar.model.entity.User;
import com.idncar.service.AlipayFaceToFacePaymentService;
import com.idncar.service.InternalVmqPaymentService;
import com.idncar.service.ManualPaymentConfirmationMailService;
import com.idncar.service.ProductCouponCodeService;
import com.idncar.service.ProductDeliveryCodeService;
import com.idncar.service.ProductService;
import com.idncar.service.UserAccessService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.Collections;
import java.util.Locale;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class AlipayFaceToFacePaymentServiceImpl implements AlipayFaceToFacePaymentService {

    private static final Logger log = LoggerFactory.getLogger(AlipayFaceToFacePaymentServiceImpl.class);
    private static final String CHANNEL_ALIPAY_F2F = "ALIPAY_F2F";
    private static final String CHANNEL_VMQ_PREFIX = "VMQ_";
    private static final String STATUS_CREATED = "CREATED";
    private static final String STATUS_WAIT_BUYER_PAY = "WAIT_BUYER_PAY";
    private static final String STATUS_TRADE_SUCCESS = "TRADE_SUCCESS";
    private static final String STATUS_TRADE_FINISHED = "TRADE_FINISHED";
    private static final String STATUS_TRADE_CLOSED = "TRADE_CLOSED";
    private static final String STATUS_FAILED = "FAILED";
    private static final BigDecimal MIN_AMOUNT = new BigDecimal("0.01");
    private static final BigDecimal MAX_AMOUNT = new BigDecimal("99999999.99");
    private static final Pattern TIMEOUT_EXPRESS_PATTERN = Pattern.compile("^(\\d+)([mhd])$", Pattern.CASE_INSENSITIVE);
    private static final Pattern ORDER_NO_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{8,64}$");
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}$", Pattern.CASE_INSENSITIVE);
    private static final Pattern VMQ_EVENT_ID_PATTERN = Pattern.compile("^[a-fA-F0-9]{64}$");
    private static final long VMQ_EVENT_ORDER_CLOCK_SKEW_MILLIS = 10_000L;
    private static final DateTimeFormatter OUT_TRADE_NO_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    @Autowired
    private AlipayPaymentProperties alipayProperties;

    @Autowired
    private InternalVmqPaymentService internalVmqPaymentService;

    @Autowired
    private PaymentOrderMapper paymentOrderMapper;

    @Autowired
    private PaymentVmqEventMapper paymentVmqEventMapper;

    @Autowired
    private ProductMapper productMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private AdminOperationLogMapper adminOperationLogMapper;

    @Autowired
    private ProductService productService;

    @Autowired
    private ProductCouponCodeService productCouponCodeService;

    @Autowired
    private ProductDeliveryCodeService productDeliveryCodeService;

    @Autowired
    private ManualPaymentConfirmationMailService manualPaymentConfirmationMailService;

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Override
    public PaymentOrderDto precreate(Long userId, AlipayFaceToFacePrecreateRequest request) {
        AlipayFaceToFacePrecreateRequest safeRequest = request == null ? new AlipayFaceToFacePrecreateRequest() : request;
        Product product = resolveProduct(safeRequest);
        productDeliveryCodeService.requireAvailableDeliveryCode(product);
        String deliveryEmail = resolveDeliveryEmail(product, safeRequest.getDeliveryEmail());
        String normalizedCouponCode = normalizeCouponCode(safeRequest.getCouponCode());
        if (product == null && normalizedCouponCode != null) {
            throw ApiException.badRequest("优惠码只能用于商品订单");
        }
        BigDecimal originalAmount = product == null ? normalizeAmount(safeRequest.getTotalAmount()) : normalizeProductOrderAmount(product.getPrice());
        if (product != null && originalAmount.compareTo(BigDecimal.ZERO) == 0) {
            if (normalizedCouponCode != null) {
                throw ApiException.badRequest("免费商品无需使用优惠码");
            }
            return createFreeProductOrder(userId, product, originalAmount, deliveryEmail);
        }

        requirePaymentGatewayConfigured();

        PaymentOrder reusableOrder = findReusableProductOrder(userId, product, normalizedCouponCode, deliveryEmail);
        if (reusableOrder != null) {
            return PaymentOrderDto.fromEntity(reusableOrder);
        }

        ProductCouponCode couponCode = product == null || normalizedCouponCode == null
                ? null
                : productCouponCodeService.requireUsableCoupon(product, normalizedCouponCode);
        BigDecimal discountAmount = couponCode == null
                ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                : productCouponCodeService.calculateDiscountAmount(couponCode, originalAmount);
        BigDecimal amount = originalAmount.subtract(discountAmount).setScale(2, RoundingMode.HALF_UP);
        if (amount.compareTo(MIN_AMOUNT) < 0) {
            amount = MIN_AMOUNT;
            discountAmount = originalAmount.subtract(amount).setScale(2, RoundingMode.HALF_UP);
        }
        String subject = product == null
                ? limitText(requireText(safeRequest.getSubject(), "请输入订单标题"), 256)
                : limitText(product.getTitle(), 256);
        String body = product == null
                ? limitText(normalizeNullableText(safeRequest.getBody()), 500)
                : limitText(firstText(product.getSubtitle(), product.getDescription()), 500);

        PaymentOrder order = new PaymentOrder();
        order.setChannel(resolvePaymentChannel());
        order.setOutTradeNo(generateOutTradeNo());
        order.setSubject(subject);
        order.setBody(body);
        order.setOriginalAmount(originalAmount);
        order.setDiscountAmount(discountAmount);
        order.setCouponCode(couponCode == null ? null : couponCode.getCode());
        order.setCouponCodeId(couponCode == null ? null : couponCode.getId());
        order.setTotalAmount(amount);
        order.setStatus(STATUS_CREATED);
        order.setResourceType(product == null ? limitText(normalizeResourceType(safeRequest.getResourceType()), 60) : "PRODUCT");
        order.setResourceId(product == null ? safeRequest.getResourceId() : product.getId());
        order.setPayerUserId(userId);
        order.setDeliveryEmail(deliveryEmail);
        order.setExpireTime(resolvePaymentExpireTime());
        paymentOrderMapper.insert(order);

        boolean couponLocked = false;
        try {
            if (couponCode != null) {
                productCouponCodeService.lockCouponForOrder(couponCode, userId, order.getOutTradeNo());
                couponLocked = true;
            }

            if (isVmqOrder(order)) {
                precreateWithVmq(order);
            } else {
                precreateWithAlipay(order);
            }
            PaymentOrder saved = paymentOrderMapper.selectById(order.getId());
            manualPaymentConfirmationMailService.sendOrderCreated(saved, userId == null ? null : userMapper.selectById(userId));
            return PaymentOrderDto.fromEntity(saved);
        } catch (ApiException exception) {
            if (couponLocked) {
                productCouponCodeService.releaseCouponForOrder(order);
            }
            if (!STATUS_FAILED.equals(order.getStatus())) {
                markFailed(order, limitText(exception.getMessage(), 500));
            }
            throw exception;
        } catch (AlipayApiException exception) {
            if (couponLocked) {
                productCouponCodeService.releaseCouponForOrder(order);
            }
            markFailed(order, limitText(exception.getMessage(), 500));
            log.warn("Alipay precreate failed: {}", exception.getMessage());
            throw ApiException.badGateway("支付宝预下单请求失败，请稍后重试");
        }
    }

    private PaymentOrderDto createFreeProductOrder(Long userId, Product product, BigDecimal originalAmount, String deliveryEmail) {
        return transactionTemplate.execute(status -> {
            PaymentOrder order = new PaymentOrder();
            order.setChannel(resolvePaymentChannel());
            order.setOutTradeNo(generateOutTradeNo());
            order.setSubject(limitText(product.getTitle(), 256));
            order.setBody(limitText(firstText(product.getSubtitle(), product.getDescription()), 500));
            order.setOriginalAmount(originalAmount);
            order.setDiscountAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            order.setTotalAmount(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
            order.setStatus(STATUS_CREATED);
            order.setResourceType("PRODUCT");
            order.setResourceId(product.getId());
            order.setPayerUserId(userId);
            order.setDeliveryEmail(deliveryEmail);
            paymentOrderMapper.insert(order);

            if (productMapper.markPaid(product.getId()) <= 0) {
                throw ApiException.badRequest("商品库存不足，请刷新后重试");
            }

            String deliveryError = productDeliveryCodeService.fulfillPaidOrder(order);
            if (deliveryError != null) {
                if (isFreeOrderBlockingDeliveryError(deliveryError)) {
                    throw ApiException.badRequest("该虚拟商品CDK库存不足，请刷新后重试");
                }
                order.setLastError(appendError(order.getLastError(), deliveryError));
                log.warn("Free product order delivery requires manual handling: outTradeNo={}, productId={}, error={}",
                        order.getOutTradeNo(), order.getResourceId(), deliveryError);
            }

            order.setStatus(STATUS_TRADE_SUCCESS);
            order.setPaidTime(new Date());
            order.setPaidHandled(Boolean.TRUE);
            paymentOrderMapper.updateById(order);
            return PaymentOrderDto.fromEntity(paymentOrderMapper.selectById(order.getId()));
        });
    }

    private boolean isFreeOrderBlockingDeliveryError(String deliveryError) {
        String normalized = normalizeNullableText(deliveryError);
        return normalized != null && normalized.contains("CDK库存不足");
    }

    private void precreateWithVmq(PaymentOrder order) {
        InternalVmqPaymentService.VmqOrderDraft draft = internalVmqPaymentService.createOrderDraft(order);
        order.setTradeNo(order.getOutTradeNo());
        order.setBuyerLogonId(vmqPayTypeLabel(draft.payType()));
        order.setTotalAmount(draft.reallyPrice().setScale(2, RoundingMode.HALF_UP));
        order.setQrCode(limitText(draft.payUrl(), 512));
        order.setStatus(STATUS_WAIT_BUYER_PAY);
        order.setExpireTime(draft.expireTime());
        paymentOrderMapper.updateById(order);
    }

    private void precreateWithAlipay(PaymentOrder order) throws AlipayApiException {
        AlipayTradePrecreateRequest alipayRequest = new AlipayTradePrecreateRequest();
        alipayRequest.setNotifyUrl(alipayProperties.getNotifyUrl());

        AlipayTradePrecreateModel model = new AlipayTradePrecreateModel();
        model.setOutTradeNo(order.getOutTradeNo());
        model.setSubject(order.getSubject());
        model.setTotalAmount(order.getTotalAmount().toPlainString());
        model.setBody(order.getBody());
        model.setTimeoutExpress(alipayProperties.getQrCodeTimeoutExpress());
        alipayRequest.setBizModel(model);

        AlipayTradePrecreateResponse response = executeAlipay(alipayRequest);
        if (!response.isSuccess()) {
            markFailed(order, buildAlipayError(response.getCode(), response.getSubCode(), response.getSubMsg()));
            throw ApiException.badGateway("支付宝预下单失败：" + safeAlipayMessage(response.getSubMsg(), response.getMsg()));
        }

        order.setQrCode(response.getQrCode());
        order.setStatus(STATUS_WAIT_BUYER_PAY);
        paymentOrderMapper.updateById(order);
    }

    @Override
    public PaymentOrderDto query(Long userId, String outTradeNo) {
        PaymentOrder order = requireOwnedOrder(userId, outTradeNo);
        return PaymentOrderDto.fromEntity(queryPaymentOrder(order));
    }

    @Override
    public PaymentOrderDto close(Long userId, String outTradeNo) {
        PaymentOrder order = requireOwnedOrder(userId, outTradeNo);
        return PaymentOrderDto.fromEntity(closePaymentOrder(order));
    }

    @Override
    public PageResultDto<PaymentOrderDto> getUserOrders(Long userId, Integer page, Integer size, String status, String keyword) {
        userAccessService.requireActiveUser(userId);
        int safePage = page == null ? 1 : Math.max(1, page);
        int safeSize = size == null ? 10 : Math.max(1, Math.min(size, 100));

        QueryWrapper<PaymentOrder> queryWrapper = new QueryWrapper<PaymentOrder>()
                .and(wrapper -> wrapper.eq("channel", CHANNEL_ALIPAY_F2F).or().likeRight("channel", CHANNEL_VMQ_PREFIX))
                .eq("payer_user_id", userId);
        applyOrderStatusFilter(queryWrapper, status);
        applyUserOrderKeywordFilter(queryWrapper, keyword);
        queryWrapper.orderByDesc("create_time");

        Page<PaymentOrder> result = paymentOrderMapper.selectPage(new Page<>(safePage, safeSize), queryWrapper);
        List<PaymentOrderDto> records = result.getRecords().stream()
                .map(PaymentOrderDto::fromEntity)
                .collect(Collectors.toList());
        return PageResultDto.of(records, result.getTotal(), safePage, safeSize);
    }

    @Override
    public PageResultDto<AdminPaymentOrderDto> getAdminOrders(Long adminUserId, Integer page, Integer size, String keyword, String status, String resourceType, Boolean hasError, Boolean hasCoupon) {
        userAccessService.requireAdmin(adminUserId);
        int safePage = page == null ? 1 : Math.max(1, page);
        int safeSize = size == null ? 10 : Math.max(1, Math.min(size, 100));

        QueryWrapper<PaymentOrder> queryWrapper = new QueryWrapper<>();
        applyAdminOrderFilters(queryWrapper, keyword, status, resourceType, hasError, hasCoupon);
        queryWrapper.orderByDesc("create_time");

        Page<PaymentOrder> result = paymentOrderMapper.selectPage(new Page<>(safePage, safeSize), queryWrapper);
        return PageResultDto.of(toAdminPaymentOrderDtos(result.getRecords()), result.getTotal(), safePage, safeSize);
    }

    @Override
    public AdminPaymentOrderStatsDto getAdminOrderStats(Long adminUserId) {
        userAccessService.requireAdmin(adminUserId);
        Long total = paymentOrderMapper.selectCount(new QueryWrapper<>());
        Long created = paymentOrderMapper.selectCount(new QueryWrapper<PaymentOrder>().eq("status", STATUS_CREATED));
        Long waiting = paymentOrderMapper.selectCount(new QueryWrapper<PaymentOrder>().eq("status", STATUS_WAIT_BUYER_PAY));
        Long paid = paymentOrderMapper.selectCount(new QueryWrapper<PaymentOrder>()
                .in("status", List.of(STATUS_TRADE_SUCCESS, STATUS_TRADE_FINISHED)));
        Long closed = paymentOrderMapper.selectCount(new QueryWrapper<PaymentOrder>().eq("status", STATUS_TRADE_CLOSED));
        Long failed = paymentOrderMapper.selectCount(new QueryWrapper<PaymentOrder>().eq("status", STATUS_FAILED));
        Long errors = paymentOrderMapper.selectCount(new QueryWrapper<PaymentOrder>().isNotNull("last_error").ne("last_error", ""));
        return AdminPaymentOrderStatsDto.of(total, created, waiting, paid, closed, failed, errors);
    }

    @Override
    public AdminPaymentOrderDto adminQuery(Long adminUserId, String outTradeNo) {
        User operator = userAccessService.requireAdmin(adminUserId);
        PaymentOrder order = queryPaymentOrder(requireOrder(outTradeNo));
        logAdminPaymentOperation(operator, "PAYMENT_ORDER_SYNCED", order, "同步支付订单，当前状态：" + order.getStatus());
        return toAdminPaymentOrderDto(order);
    }

    @Override
    public AdminPaymentOrderDto adminClose(Long adminUserId, String outTradeNo) {
        User operator = userAccessService.requireAdmin(adminUserId);
        PaymentOrder order = closePaymentOrder(requireOrder(outTradeNo));
        logAdminPaymentOperation(operator, "PAYMENT_ORDER_CLOSED", order, "关闭未支付订单");
        return toAdminPaymentOrderDto(order);
    }

    @Override
    public AdminPaymentOrderDto adminManualConfirm(Long adminUserId, String outTradeNo, ResolvePaymentOrderRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);
        PaymentOrder order = requireOrder(outTradeNo);
        if (isPaidStatus(order.getStatus())) {
            throw ApiException.badRequest("该订单已经是已支付状态");
        }
        if (STATUS_TRADE_CLOSED.equals(order.getStatus())) {
            throw ApiException.badRequest("已关闭订单不能人工确认收款");
        }

        String note = request == null ? null : limitText(normalizeNullableText(request.getNote()), 300);
        String oldStatus = order.getStatus();
        order.setNotifyPayload(buildManualConfirmPayload(operator, note));
        order.setTradeNo(firstText(order.getTradeNo(), "MANUAL-" + order.getOutTradeNo()));
        order.setBuyerLogonId(firstText(order.getBuyerLogonId(), "ADMIN_MANUAL"));
        order.setStatus(STATUS_TRADE_SUCCESS);
        if (order.getPaidTime() == null) {
            order.setPaidTime(new Date());
        }
        order.setLastError(null);
        handlePaidTransition(order, oldStatus);
        paymentOrderMapper.updateById(order);

        PaymentOrder saved = paymentOrderMapper.selectById(order.getId());
        String detail = "人工确认收款，原状态：" + firstText(oldStatus, "-") + "，金额：" + formatAmount(saved.getTotalAmount());
        if (note != null) {
            detail += "；备注：" + note;
        }
        logAdminPaymentOperation(operator, "PAYMENT_ORDER_MANUAL_CONFIRMED", saved, detail);
        return toAdminPaymentOrderDto(saved);
    }

    @Override
    public AdminPaymentOrderDto adminResendDelivery(Long adminUserId, String outTradeNo) {
        User operator = userAccessService.requireAdmin(adminUserId);
        PaymentOrder order = requireOrder(outTradeNo);
        if (!"PRODUCT".equalsIgnoreCase(order.getResourceType()) || order.getResourceId() == null) {
            throw ApiException.badRequest("只有商品订单可以重新发货");
        }
        if (!isPaidStatus(order.getStatus())) {
            throw ApiException.badRequest("只有已支付或已领取成功的订单可以重新发货");
        }

        productDeliveryCodeService.resendPaidOrder(order);
        PaymentOrder saved = paymentOrderMapper.selectById(order.getId());
        logAdminPaymentOperation(operator, "PAYMENT_ORDER_DELIVERY_RESENT", saved,
                "重新发送商品发货邮件到：" + firstText(saved.getDeliveryEmail(), "订单用户邮箱"));
        return toAdminPaymentOrderDto(saved);
    }

    @Override
    public AdminPaymentOrderDto adminResolve(Long adminUserId, String outTradeNo, ResolvePaymentOrderRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);
        PaymentOrder order = requireOrder(outTradeNo);
        if (normalizeNullableText(order.getLastError()) == null) {
            throw ApiException.badRequest("当前订单没有待处理异常");
        }

        String note = request == null ? null : limitText(normalizeNullableText(request.getNote()), 300);
        String oldError = order.getLastError();
        order.setLastError(null);
        paymentOrderMapper.updateById(order);

        String detail = "标记支付订单异常已处理，原异常：" + limitText(oldError, 180);
        if (note != null) {
            detail += "；处理备注：" + note;
        }
        PaymentOrder saved = paymentOrderMapper.selectById(order.getId());
        logAdminPaymentOperation(operator, "PAYMENT_ORDER_RESOLVED", saved, detail);
        return toAdminPaymentOrderDto(saved);
    }

    private PaymentOrder queryPaymentOrder(PaymentOrder order) {
        return isVmqOrder(order) ? queryOrderFromVmq(order) : queryOrderFromAlipay(order);
    }

    private PaymentOrder closePaymentOrder(PaymentOrder order) {
        return isVmqOrder(order) ? closeOrderByVmq(order) : closeOrderByAlipay(order);
    }

    private PaymentOrder queryOrderFromVmq(PaymentOrder order) {
        if (isFinalStatus(order.getStatus())) {
            return settleFinalLocalState(order);
        }
        String oldStatus = order.getStatus();
        if (isExpired(order)) {
            order.setStatus(STATUS_TRADE_CLOSED);
            if (order.getClosedTime() == null) {
                order.setClosedTime(new Date());
            }
            handleClosedTransition(order, oldStatus);
        } else if (STATUS_CREATED.equals(order.getStatus())) {
            order.setStatus(STATUS_WAIT_BUYER_PAY);
        }
        paymentOrderMapper.updateById(order);
        return paymentOrderMapper.selectById(order.getId());
    }

    private PaymentOrder closeOrderByVmq(PaymentOrder order) {
        if (STATUS_TRADE_SUCCESS.equals(order.getStatus()) || STATUS_TRADE_FINISHED.equals(order.getStatus())) {
            throw ApiException.badRequest("已支付订单不能关单");
        }
        if (STATUS_TRADE_CLOSED.equals(order.getStatus())) {
            return order;
        }
        String oldStatus = order.getStatus();
        order.setStatus(STATUS_TRADE_CLOSED);
        order.setClosedTime(new Date());
        handleClosedTransition(order, oldStatus);
        paymentOrderMapper.updateById(order);
        return paymentOrderMapper.selectById(order.getId());
    }

    private PaymentOrder queryOrderFromAlipay(PaymentOrder order) {
        if (isFinalStatus(order.getStatus())) {
            return settleFinalLocalState(order);
        }
        requireAlipayConfigured();

        try {
            AlipayTradeQueryRequest request = new AlipayTradeQueryRequest();
            AlipayTradeQueryModel model = new AlipayTradeQueryModel();
            model.setOutTradeNo(order.getOutTradeNo());
            request.setBizModel(model);

            AlipayTradeQueryResponse response = executeAlipay(request);
            if (!response.isSuccess()) {
                order.setLastError(buildAlipayError(response.getCode(), response.getSubCode(), response.getSubMsg()));
                paymentOrderMapper.updateById(order);
                throw ApiException.badGateway("支付宝订单查询失败：" + safeAlipayMessage(response.getSubMsg(), response.getMsg()));
            }

            String oldStatus = order.getStatus();
            applyTradeStatus(order, response.getTradeStatus(), response.getTradeNo(), response.getBuyerLogonId());
            handlePaidTransition(order, oldStatus);
            handleClosedTransition(order, oldStatus);
            paymentOrderMapper.updateById(order);
            return paymentOrderMapper.selectById(order.getId());
        } catch (AlipayApiException exception) {
            log.warn("Alipay query failed for {}: {}", order.getOutTradeNo(), exception.getMessage());
            throw ApiException.badGateway("支付宝订单查询请求失败，请稍后重试");
        }
    }

    private PaymentOrder settleFinalLocalState(PaymentOrder order) {
        handlePaidTransition(order, order.getStatus());
        handleClosedTransition(order, null);
        paymentOrderMapper.updateById(order);
        return paymentOrderMapper.selectById(order.getId());
    }

    private PaymentOrder closeOrderByAlipay(PaymentOrder order) {
        if (STATUS_TRADE_SUCCESS.equals(order.getStatus()) || STATUS_TRADE_FINISHED.equals(order.getStatus())) {
            throw ApiException.badRequest("已支付订单不能关单");
        }
        if (STATUS_TRADE_CLOSED.equals(order.getStatus())) {
            return order;
        }
        requireAlipayConfigured();

        try {
            AlipayTradeCloseRequest request = new AlipayTradeCloseRequest();
            AlipayTradeCloseModel model = new AlipayTradeCloseModel();
            model.setOutTradeNo(order.getOutTradeNo());
            request.setBizModel(model);

            AlipayTradeCloseResponse response = executeAlipay(request);
            if (!response.isSuccess()) {
                order.setLastError(buildAlipayError(response.getCode(), response.getSubCode(), response.getSubMsg()));
                paymentOrderMapper.updateById(order);
                throw ApiException.badGateway("支付宝关单失败：" + safeAlipayMessage(response.getSubMsg(), response.getMsg()));
            }

            order.setTradeNo(firstText(response.getTradeNo(), order.getTradeNo()));
            String oldStatus = order.getStatus();
            order.setStatus(STATUS_TRADE_CLOSED);
            order.setClosedTime(new Date());
            handleClosedTransition(order, oldStatus);
            paymentOrderMapper.updateById(order);
            return paymentOrderMapper.selectById(order.getId());
        } catch (AlipayApiException exception) {
            log.warn("Alipay close failed for {}: {}", order.getOutTradeNo(), exception.getMessage());
            throw ApiException.badGateway("支付宝关单请求失败，请稍后重试");
        }
    }

    @Override
    public boolean handleNotify(Map<String, String> params) {
        if (!alipayProperties.isConfigured()) {
            log.warn("Alipay notify received while payment config is incomplete");
            return false;
        }
        if (params == null || params.isEmpty()) {
            return false;
        }

        try {
            boolean verified = AlipaySignature.rsaCheckV1(
                    params,
                    alipayProperties.normalizedAlipayPublicKey(),
                    alipayProperties.getCharset(),
                    firstText(params.get("sign_type"), alipayProperties.getSignType())
            );
            if (!verified) {
                log.warn("Alipay notify sign verification failed: out_trade_no={}", params.get("out_trade_no"));
                return false;
            }
        } catch (AlipayApiException exception) {
            log.warn("Alipay notify sign verification error: {}", exception.getMessage());
            return false;
        }

        String appId = normalizeNullableText(params.get("app_id"));
        if (!alipayProperties.getAppId().equals(appId)) {
            log.warn("Alipay notify app_id mismatch: expected={}, actual={}", alipayProperties.getAppId(), appId);
            return false;
        }

        String outTradeNo = normalizeNullableText(params.get("out_trade_no"));
        PaymentOrder order = findByOutTradeNo(outTradeNo);
        if (order == null) {
            log.warn("Alipay notify references unknown order: {}", outTradeNo);
            return false;
        }

        BigDecimal notifyAmount = parseAmount(params.get("total_amount"));
        if (notifyAmount == null || order.getTotalAmount() == null || order.getTotalAmount().compareTo(notifyAmount) != 0) {
            log.warn("Alipay notify amount mismatch: out_trade_no={}, expected={}, actual={}",
                    outTradeNo, order.getTotalAmount(), notifyAmount);
            return false;
        }

        order.setNotifyPayload(serializeNotifyParams(params));
        String oldStatus = order.getStatus();
        applyTradeStatus(order, params.get("trade_status"), params.get("trade_no"), params.get("buyer_logon_id"));
        handlePaidTransition(order, oldStatus);
        handleClosedTransition(order, oldStatus);
        paymentOrderMapper.updateById(order);
        return true;
    }

    @Override
    public boolean handleVmqNotify(Map<String, String> params) {
        if (params == null || params.isEmpty()) {
            return false;
        }
        if (!internalVmqPaymentService.verifyNotify(params)) {
            log.warn("Vmq notify sign verification failed: payId={}", params.get("payId"));
            return false;
        }

        String outTradeNo = normalizeNullableText(params.get("payId"));
        PaymentOrder order = findByOutTradeNo(outTradeNo);
        if (order == null) {
            log.warn("Vmq notify references unknown order: {}", outTradeNo);
            return false;
        }
        if (!isVmqOrder(order)) {
            log.warn("Vmq notify references non-vmq order: outTradeNo={}, channel={}", outTradeNo, order.getChannel());
            return false;
        }

        BigDecimal notifyPrice = parseAmount(params.get("price"));
        BigDecimal notifyReallyPrice = parseAmount(params.get("reallyPrice"));
        BigDecimal expectedPrice = resolveRequestedAmount(order);
        if (notifyPrice == null || expectedPrice == null || expectedPrice.compareTo(notifyPrice) != 0) {
            log.warn("Vmq notify price mismatch: outTradeNo={}, expected={}, actual={}",
                    outTradeNo, expectedPrice, notifyPrice);
            return false;
        }
        if (notifyReallyPrice == null || order.getTotalAmount() == null || order.getTotalAmount().compareTo(notifyReallyPrice) != 0) {
            log.warn("Vmq notify reallyPrice mismatch: outTradeNo={}, expected={}, actual={}",
                    outTradeNo, order.getTotalAmount(), notifyReallyPrice);
            return false;
        }

        order.setNotifyPayload(serializeNotifyParams(params));
        order.setBuyerLogonId(vmqPayTypeLabel(parseInteger(params.get("type"), 2)));
        order.setTotalAmount(notifyReallyPrice.setScale(2, RoundingMode.HALF_UP));
        String oldStatus = order.getStatus();
        order.setStatus(STATUS_TRADE_SUCCESS);
        if (order.getPaidTime() == null) {
            order.setPaidTime(new Date());
        }
        handlePaidTransition(order, oldStatus);
        paymentOrderMapper.updateById(order);
        return true;
    }

    @Override
    public boolean handleVmqAppPush(Map<String, String> params) {
        if (params == null || params.isEmpty()) {
            return false;
        }
        if (!internalVmqPaymentService.verifyAppPush(params)) {
            log.warn("Vmq appPush sign verification failed: type={}, price={}", params.get("type"), params.get("price"));
            return false;
        }

        String eventId = normalizeNullableText(params.get("eventId"));
        Long paidAtEpoch = parsePositiveLong(params.get("paidAt"));
        if (eventId == null || !VMQ_EVENT_ID_PATTERN.matcher(eventId).matches() || paidAtEpoch == null) {
            log.warn("Vmq appPush event metadata invalid: eventId={}, paidAt={}", eventId, params.get("paidAt"));
            return false;
        }
        Date eventPaidAt = new Date(paidAtEpoch * 1000L);
        int payType = parseInteger(params.get("type"), 0);
        BigDecimal paidAmount = parseAmount(params.get("price"));
        if ((payType != 1 && payType != 2) || paidAmount == null) {
            log.warn("Vmq appPush invalid payment payload: type={}, price={}", params.get("type"), params.get("price"));
            return false;
        }

        PaymentVmqEvent paymentEvent = new PaymentVmqEvent();
        paymentEvent.setEventId(eventId.toLowerCase(Locale.ROOT));
        paymentEvent.setPayType(payType);
        paymentEvent.setAmount(paidAmount.setScale(2, RoundingMode.HALF_UP));
        paymentEvent.setPaidAt(eventPaidAt);
        paymentEvent.setStatus("RECEIVED");
        paymentEvent.setPayload(serializeNotifyParams(params));
        try {
            paymentVmqEventMapper.insert(paymentEvent);
        } catch (DuplicateKeyException exception) {
            log.info("Duplicate Vmq appPush ignored: eventId={}", eventId);
            return true;
        }

        if ("TEST".equalsIgnoreCase(normalizeNullableText(params.get("mode")))) {
            markVmqEvent(paymentEvent, "TEST", null);
            log.info("Vmq test push accepted without matching an order: eventId={}, type={}, price={}",
                    eventId, payType, paidAmount);
            return true;
        }

        internalVmqPaymentService.recordAppPush();
        PaymentOrder order = findVmqAppPushOrder(params, payType, paidAmount, eventPaidAt);
        if (order == null) {
            log.warn("Vmq appPush has no matching order: type={}, price={}", payType, paidAmount);
            markVmqEvent(paymentEvent, "UNMATCHED", null);
            return true;
        }
        if (isFinalStatus(order.getStatus())) {
            markVmqEvent(paymentEvent, "IGNORED", order.getOutTradeNo());
            return true;
        }
        BigDecimal expectedAmount = order.getTotalAmount() == null
                ? null
                : order.getTotalAmount().setScale(2, RoundingMode.HALF_UP);
        if (expectedAmount == null || expectedAmount.compareTo(paidAmount.setScale(2, RoundingMode.HALF_UP)) != 0) {
            log.warn("Vmq appPush amount mismatch: outTradeNo={}, expected={}, actual={}",
                    order.getOutTradeNo(), expectedAmount, paidAmount);
            markVmqEvent(paymentEvent, "REJECTED", order.getOutTradeNo());
            return true;
        }

        order.setNotifyPayload(serializeNotifyParams(params));
        order.setBuyerLogonId(vmqPayTypeLabel(payType));
        order.setTradeNo(firstText(order.getTradeNo(), order.getOutTradeNo()));
        order.setTotalAmount(paidAmount.setScale(2, RoundingMode.HALF_UP));
        String oldStatus = order.getStatus();
        order.setStatus(STATUS_TRADE_SUCCESS);
        if (order.getPaidTime() == null) {
            order.setPaidTime(new Date());
        }
        handlePaidTransition(order, oldStatus);
        paymentOrderMapper.updateById(order);
        markVmqEvent(paymentEvent, "MATCHED", order.getOutTradeNo());
        return true;
    }

    private Product resolveProduct(AlipayFaceToFacePrecreateRequest request) {
        Long productId = request.getProductId();
        if (productId == null
                && "PRODUCT".equalsIgnoreCase(normalizeNullableText(request.getResourceType()))
                && request.getResourceId() != null) {
            productId = request.getResourceId();
        }
        if (productId == null) {
            return null;
        }
        return productService.requirePurchasableProduct(productId);
    }

    private PaymentOrder findReusableProductOrder(Long userId, Product product, String couponCode, String deliveryEmail) {
        if (userId == null || product == null) {
            return null;
        }
        QueryWrapper<PaymentOrder> queryWrapper = new QueryWrapper<PaymentOrder>()
                .eq("channel", resolvePaymentChannel())
                .eq("payer_user_id", userId)
                .eq("resource_type", "PRODUCT")
                .eq("resource_id", product.getId())
                .in("status", STATUS_CREATED, STATUS_WAIT_BUYER_PAY)
                .isNotNull("qr_code")
                .and(wrapper -> wrapper.isNull("expire_time").or().gt("expire_time", new Date()));
        if (couponCode == null) {
            queryWrapper.and(wrapper -> wrapper.isNull("coupon_code").or().eq("coupon_code", ""));
        } else {
            queryWrapper.eq("coupon_code", couponCode);
        }
        if (deliveryEmail == null) {
            queryWrapper.and(wrapper -> wrapper.isNull("delivery_email").or().eq("delivery_email", ""));
        } else {
            queryWrapper.eq("delivery_email", deliveryEmail);
        }
        return paymentOrderMapper.selectOne(queryWrapper
                .orderByDesc("create_time")
                .last("LIMIT 1"));
    }

    private PaymentOrder findVmqAppPushOrder(Map<String, String> params, int payType,
                                              BigDecimal paidAmount, Date eventPaidAt) {
        String outTradeNo = normalizeNullableText(params.get("payId"));
        if (outTradeNo != null) {
            PaymentOrder order = findByOutTradeNo(outTradeNo);
            if (order != null && isVmqOrder(order)
                    && !isFinalStatus(order.getStatus())
                    && isVmqEventWithinOrderWindow(order, eventPaidAt)) {
                return order;
            }
        }

        Date latestOrderCreateTime = new Date(eventPaidAt.getTime() + VMQ_EVENT_ORDER_CLOCK_SKEW_MILLIS);
        Date earliestAllowedExpiry = new Date(eventPaidAt.getTime() - VMQ_EVENT_ORDER_CLOCK_SKEW_MILLIS);
        List<PaymentOrder> matches = paymentOrderMapper.selectList(new QueryWrapper<PaymentOrder>()
                .eq("channel", payType == 1 ? "VMQ_WECHAT" : "VMQ_ALIPAY")
                .eq("total_amount", paidAmount.setScale(2, RoundingMode.HALF_UP))
                .in("status", STATUS_CREATED, STATUS_WAIT_BUYER_PAY)
                .le("create_time", latestOrderCreateTime)
                .and(wrapper -> wrapper.isNull("expire_time").or().ge("expire_time", earliestAllowedExpiry))
                .orderByAsc("create_time")
                .last("LIMIT 2"));
        if (matches.isEmpty()) {
            return null;
        }
        if (matches.size() > 1) {
            log.warn("Vmq appPush amount is ambiguous: type={}, price={}, matches={}",
                    payType, paidAmount, matches.size());
            return null;
        }
        return matches.get(0);
    }

    private boolean isVmqEventWithinOrderWindow(PaymentOrder order, Date eventPaidAt) {
        if (order == null || eventPaidAt == null) {
            return false;
        }
        if (order.getCreateTime() != null
                && eventPaidAt.getTime() + VMQ_EVENT_ORDER_CLOCK_SKEW_MILLIS < order.getCreateTime().getTime()) {
            return false;
        }
        return order.getExpireTime() == null
                || eventPaidAt.getTime() - VMQ_EVENT_ORDER_CLOCK_SKEW_MILLIS <= order.getExpireTime().getTime();
    }

    private void markVmqEvent(PaymentVmqEvent event, String status, String orderNo) {
        event.setStatus(status);
        event.setOrderNo(orderNo);
        event.setUpdateTime(new Date());
        paymentVmqEventMapper.updateById(event);
    }

    private String resolveDeliveryEmail(Product product, String deliveryEmail) {
        if (product == null) {
            return null;
        }
        String normalizedEmail = normalizeNullableText(deliveryEmail);
        if (normalizedEmail == null) {
            throw ApiException.badRequest("商品购买需要填写收货邮箱");
        }
        normalizedEmail = normalizedEmail.toLowerCase(Locale.ROOT);
        if (!EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            throw ApiException.badRequest("收货邮箱格式不正确");
        }
        return limitText(normalizedEmail, 120);
    }

    private boolean isExpired(PaymentOrder order) {
        return order != null && order.getExpireTime() != null && order.getExpireTime().before(new Date());
    }

    private void handlePaidTransition(PaymentOrder order, String oldStatus) {
        if ((!isPaidStatus(oldStatus) || !Boolean.TRUE.equals(order.getPaidHandled()))
                && isPaidStatus(order.getStatus())
                && "PRODUCT".equalsIgnoreCase(order.getResourceType())
                && order.getResourceId() != null) {
            if (paymentOrderMapper.markPaidHandledIfNeeded(order.getId()) > 0) {
                if (order.getCouponCodeId() != null && productCouponCodeService.markCouponUsedForOrder(order) <= 0) {
                    order.setLastError(appendError(order.getLastError(), "优惠码状态更新失败，支付成功后需要人工处理"));
                    log.warn("Paid product order coupon mark-used failed: outTradeNo={}, couponCodeId={}",
                            order.getOutTradeNo(), order.getCouponCodeId());
                }
                if (productMapper.markPaid(order.getResourceId()) <= 0) {
                    String message = "商品库存不足或商品不存在，支付成功后需要人工处理";
                    order.setLastError(appendError(order.getLastError(), message));
                    log.warn("Paid product order requires manual settlement: outTradeNo={}, productId={}",
                            order.getOutTradeNo(), order.getResourceId());
                } else {
                    String deliveryError = productDeliveryCodeService.fulfillPaidOrder(order);
                    if (deliveryError != null) {
                        order.setLastError(appendError(order.getLastError(), deliveryError));
                        log.warn("Paid product order delivery requires manual handling: outTradeNo={}, productId={}, error={}",
                                order.getOutTradeNo(), order.getResourceId(), deliveryError);
                    }
                }
            }
            order.setPaidHandled(Boolean.TRUE);
        }
    }

    private void handleClosedTransition(PaymentOrder order, String oldStatus) {
        if (!STATUS_TRADE_CLOSED.equals(oldStatus) && STATUS_TRADE_CLOSED.equals(order.getStatus())) {
            productCouponCodeService.releaseCouponForOrder(order);
        }
    }

    private <T extends AlipayResponse> T executeAlipay(AlipayRequest<T> request) throws AlipayApiException {
        if (alipayProperties.isEncryptEnabled()) {
            request.setNeedEncrypt(true);
        }
        return alipayClient().execute(request);
    }

    private AlipayClient alipayClient() throws AlipayApiException {
        AlipayConfig config = new AlipayConfig();
        config.setServerUrl(alipayProperties.getGatewayUrl());
        config.setAppId(alipayProperties.getAppId());
        config.setPrivateKey(alipayProperties.normalizedPrivateKey());
        config.setFormat(alipayProperties.getFormat());
        config.setCharset(alipayProperties.getCharset());
        config.setAlipayPublicKey(alipayProperties.normalizedAlipayPublicKey());
        config.setSignType(alipayProperties.getSignType());
        if (alipayProperties.isEncryptEnabled()) {
            config.setEncryptType(alipayProperties.normalizedEncryptType());
            config.setEncryptKey(alipayProperties.normalizedEncryptKey());
        }
        return new DefaultAlipayClient(config);
    }

    private void requireAlipayConfigured() {
        if (!alipayProperties.isConfigured()) {
            throw ApiException.badRequest("支付宝当面付未启用或配置不完整");
        }
    }

    private void requirePaymentGatewayConfigured() {
        if (useVmqPayment()) {
            return;
        }
        if (internalVmqPaymentService.isEnabled()
                && (internalVmqPaymentService.isPreferred() || !alipayProperties.isConfigured())) {
            throw ApiException.badRequest("V免签未启用或配置不完整");
        }
        if (alipayProperties.isConfigured()) {
            return;
        }
        throw ApiException.badRequest("支付通道未启用或配置不完整");
    }

    private boolean useVmqPayment() {
        if (!internalVmqPaymentService.isConfigured()) {
            return false;
        }
        return internalVmqPaymentService.isPreferred() || !alipayProperties.isConfigured();
    }

    private String resolvePaymentChannel() {
        return useVmqPayment() ? internalVmqPaymentService.resolveChannelCode() : CHANNEL_ALIPAY_F2F;
    }

    private boolean isVmqOrder(PaymentOrder order) {
        return order != null && isVmqChannel(order.getChannel());
    }

    private boolean isVmqChannel(String channel) {
        return channel != null && channel.trim().toUpperCase(Locale.ROOT).startsWith(CHANNEL_VMQ_PREFIX);
    }

    private Date resolvePaymentExpireTime() {
        return useVmqPayment() ? null : resolveExpireTime();
    }

    private String vmqPayTypeLabel(int payType) {
        return payType == 1 ? "WECHAT" : "ALIPAY";
    }

    private BigDecimal resolveRequestedAmount(PaymentOrder order) {
        if (order == null) {
            return null;
        }
        if (order.getOriginalAmount() != null && order.getDiscountAmount() != null) {
            return order.getOriginalAmount().subtract(order.getDiscountAmount()).setScale(2, RoundingMode.HALF_UP);
        }
        return order.getTotalAmount() == null ? null : order.getTotalAmount().setScale(2, RoundingMode.HALF_UP);
    }

    private int parseInteger(String value, int fallback) {
        try {
            String normalized = normalizeNullableText(value);
            return normalized == null ? fallback : Integer.parseInt(normalized);
        } catch (RuntimeException exception) {
            return fallback;
        }
    }

    private Long parsePositiveLong(String value) {
        try {
            String normalized = normalizeNullableText(value);
            if (normalized == null) {
                return null;
            }
            long parsed = Long.parseLong(normalized);
            return parsed > 0 ? parsed : null;
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private PaymentOrder requireOwnedOrder(Long userId, String outTradeNo) {
        PaymentOrder order = requireOrder(outTradeNo);
        if (order.getPayerUserId() != null && !order.getPayerUserId().equals(userId)) {
            throw ApiException.forbidden("无权访问该支付订单");
        }
        return order;
    }

    private PaymentOrder requireOrder(String outTradeNo) {
        String normalizedOutTradeNo = requireText(outTradeNo, "订单号不能为空");
        if (!ORDER_NO_PATTERN.matcher(normalizedOutTradeNo).matches()) {
            throw ApiException.badRequest("支付订单号格式不正确");
        }
        PaymentOrder order = findByOutTradeNo(normalizedOutTradeNo);
        if (order == null) {
            throw ApiException.notFound("支付订单不存在");
        }
        return order;
    }

    private void applyAdminOrderFilters(QueryWrapper<PaymentOrder> queryWrapper, String keyword, String status, String resourceType, Boolean hasError, Boolean hasCoupon) {
        String normalizedKeyword = normalizeNullableText(keyword);
        if (normalizedKeyword != null) {
            List<Long> payerUserIds = userMapper.selectList(new QueryWrapper<User>()
                            .like("nickname", normalizedKeyword)
                            .or()
                            .like("username", normalizedKeyword)
                            .or()
                            .like("email", normalizedKeyword))
                    .stream()
                    .map(User::getId)
                    .collect(Collectors.toList());

            queryWrapper.and(wrapper -> {
                wrapper.like("out_trade_no", normalizedKeyword)
                        .or()
                        .like("trade_no", normalizedKeyword)
                      .or()
                      .like("buyer_logon_id", normalizedKeyword)
                      .or()
                      .like("delivery_email", normalizedKeyword)
                      .or()
                      .like("coupon_code", normalizedKeyword)
                      .or()
                      .like("subject", normalizedKeyword)
                        .or()
                        .like("body", normalizedKeyword);
                if (!payerUserIds.isEmpty()) {
                    wrapper.or().in("payer_user_id", payerUserIds);
                }
            });
        }

        String normalizedStatus = normalizeNullableText(status);
        if (normalizedStatus != null && !"ALL".equalsIgnoreCase(normalizedStatus)) {
            queryWrapper.eq("status", normalizeOrderStatusFilter(normalizedStatus));
        }

        String normalizedResourceType = normalizeNullableText(resourceType);
        if (normalizedResourceType != null && !"ALL".equalsIgnoreCase(normalizedResourceType)) {
            queryWrapper.eq("resource_type", limitText(normalizedResourceType.toUpperCase(Locale.ROOT), 60));
        }

        if (hasError != null) {
            if (hasError) {
                queryWrapper.isNotNull("last_error").ne("last_error", "");
            } else {
                queryWrapper.and(wrapper -> wrapper.isNull("last_error").or().eq("last_error", ""));
            }
        }

        if (hasCoupon != null) {
            if (hasCoupon) {
                queryWrapper.isNotNull("coupon_code").ne("coupon_code", "");
            } else {
                queryWrapper.and(wrapper -> wrapper.isNull("coupon_code").or().eq("coupon_code", ""));
            }
        }
    }

    private List<AdminPaymentOrderDto> toAdminPaymentOrderDtos(List<PaymentOrder> orders) {
        List<Long> payerUserIds = orders.stream()
                .map(PaymentOrder::getPayerUserId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, User> payers = payerUserIds.isEmpty()
                ? Collections.emptyMap()
                : userMapper.selectBatchIds(payerUserIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return orders.stream()
                .map(order -> AdminPaymentOrderDto.fromEntity(order, payers.get(order.getPayerUserId())))
                .collect(Collectors.toList());
    }

    private AdminPaymentOrderDto toAdminPaymentOrderDto(PaymentOrder order) {
        User payer = order.getPayerUserId() == null ? null : userMapper.selectById(order.getPayerUserId());
        return AdminPaymentOrderDto.fromEntity(order, payer);
    }

    private void logAdminPaymentOperation(User operator, String actionType, PaymentOrder order, String detail) {
        AdminOperationLog log = new AdminOperationLog();
        log.setOperatorId(operator.getId());
        log.setOperatorRole(operator.getRole());
        log.setActionType(actionType);
        log.setTargetType("PAYMENT_ORDER");
        log.setTargetId(order.getId());
        log.setTargetName(limitText(order.getOutTradeNo(), 160));
        log.setDetail(limitText(detail, 500));
        log.setCreateTime(new Date());
        adminOperationLogMapper.insert(log);
    }

    private void applyUserOrderKeywordFilter(QueryWrapper<PaymentOrder> queryWrapper, String keyword) {
        String normalizedKeyword = normalizeNullableText(keyword);
        if (normalizedKeyword == null) {
            return;
        }

        queryWrapper.and(wrapper -> wrapper
                .like("out_trade_no", normalizedKeyword)
                .or()
                .like("trade_no", normalizedKeyword)
                .or()
                .like("buyer_logon_id", normalizedKeyword)
                .or()
                .like("delivery_email", normalizedKeyword)
                .or()
                .like("coupon_code", normalizedKeyword)
                .or()
                .like("subject", normalizedKeyword)
                .or()
                .like("body", normalizedKeyword));
    }

    private void applyOrderStatusFilter(QueryWrapper<PaymentOrder> queryWrapper, String status) {
        String normalizedStatus = normalizeNullableText(status);
        if (normalizedStatus == null || "ALL".equalsIgnoreCase(normalizedStatus)) {
            return;
        }
        queryWrapper.eq("status", normalizeOrderStatusFilter(normalizedStatus));
    }

    private String normalizeOrderStatusFilter(String status) {
        String upperStatus = status.toUpperCase(Locale.ROOT);
        if (!List.of(STATUS_CREATED, STATUS_WAIT_BUYER_PAY, STATUS_TRADE_SUCCESS, STATUS_TRADE_FINISHED, STATUS_TRADE_CLOSED, STATUS_FAILED).contains(upperStatus)) {
            throw ApiException.badRequest("支付状态筛选不支持");
        }
        return upperStatus;
    }

    private PaymentOrder findByOutTradeNo(String outTradeNo) {
        String normalized = normalizeNullableText(outTradeNo);
        if (normalized == null) {
            return null;
        }
        return paymentOrderMapper.selectOne(new QueryWrapper<PaymentOrder>()
                .eq("out_trade_no", normalized)
                .last("LIMIT 1"));
    }

    private void applyTradeStatus(PaymentOrder order, String tradeStatus, String tradeNo, String buyerLogonId) {
        String normalizedStatus = normalizeNullableText(tradeStatus);
        if (normalizedStatus != null) {
            order.setStatus(limitText(normalizedStatus.toUpperCase(Locale.ROOT), 30));
        }
        order.setTradeNo(firstText(tradeNo, order.getTradeNo()));
        order.setBuyerLogonId(firstText(buyerLogonId, order.getBuyerLogonId()));

        if ((STATUS_TRADE_SUCCESS.equals(order.getStatus()) || STATUS_TRADE_FINISHED.equals(order.getStatus()))
                && order.getPaidTime() == null) {
            order.setPaidTime(new Date());
        }
        if (STATUS_TRADE_CLOSED.equals(order.getStatus()) && order.getClosedTime() == null) {
            order.setClosedTime(new Date());
        }
    }

    private boolean isFinalStatus(String status) {
        return STATUS_TRADE_SUCCESS.equals(status)
                || STATUS_TRADE_FINISHED.equals(status)
                || STATUS_TRADE_CLOSED.equals(status);
    }

    private boolean isPaidStatus(String status) {
        return STATUS_TRADE_SUCCESS.equals(status) || STATUS_TRADE_FINISHED.equals(status);
    }

    private void markFailed(PaymentOrder order, String error) {
        order.setStatus(STATUS_FAILED);
        order.setLastError(limitText(error, 500));
        paymentOrderMapper.updateById(order);
    }

    private BigDecimal normalizeAmount(BigDecimal amount) {
        if (amount == null) {
            throw ApiException.badRequest("请输入支付金额");
        }
        try {
            BigDecimal normalized = amount.setScale(2, RoundingMode.UNNECESSARY);
            if (normalized.compareTo(BigDecimal.ZERO) <= 0) {
                throw ApiException.badRequest("支付金额必须大于 0");
            }
            if (normalized.compareTo(MAX_AMOUNT) > 0) {
                throw ApiException.badRequest("支付金额超出支持范围");
            }
            return normalized;
        } catch (ArithmeticException exception) {
            throw ApiException.badRequest("支付金额最多支持两位小数");
        }
    }

    private BigDecimal normalizeProductOrderAmount(BigDecimal amount) {
        if (amount == null) {
            throw ApiException.badRequest("商品价格配置不正确");
        }
        try {
            BigDecimal normalized = amount.setScale(2, RoundingMode.UNNECESSARY);
            if (normalized.compareTo(BigDecimal.ZERO) < 0) {
                throw ApiException.badRequest("商品价格配置不正确");
            }
            if (normalized.compareTo(MAX_AMOUNT) > 0) {
                throw ApiException.badRequest("商品价格超出支持范围");
            }
            return normalized;
        } catch (ArithmeticException exception) {
            throw ApiException.badRequest("商品价格最多支持两位小数");
        }
    }

    private BigDecimal parseAmount(String value) {
        try {
            String normalized = normalizeNullableText(value);
            return normalized == null ? null : new BigDecimal(normalized).setScale(2, RoundingMode.UNNECESSARY);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    private String generateOutTradeNo() {
        String timestamp = OUT_TRADE_NO_FORMATTER.format(Instant.now().atZone(ZoneId.of("Asia/Shanghai")));
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 16).toUpperCase(Locale.ROOT);
        return "A" + timestamp + suffix;
    }

    private Date resolveExpireTime() {
        String timeoutExpress = normalizeNullableText(alipayProperties.getQrCodeTimeoutExpress());
        if (timeoutExpress == null) {
            return null;
        }
        Matcher matcher = TIMEOUT_EXPRESS_PATTERN.matcher(timeoutExpress);
        if (!matcher.matches()) {
            return null;
        }
        long amount = Long.parseLong(matcher.group(1));
        String unit = matcher.group(2).toLowerCase(Locale.ROOT);
        Duration duration = switch (unit) {
            case "h" -> Duration.ofHours(amount);
            case "d" -> Duration.ofDays(amount);
            default -> Duration.ofMinutes(amount);
        };
        return Date.from(Instant.now().plus(duration));
    }

    private String serializeNotifyParams(Map<String, String> params) {
        try {
            return objectMapper.writeValueAsString(params);
        } catch (JsonProcessingException exception) {
            return params.toString();
        }
    }

    private String buildManualConfirmPayload(User operator, String note) {
        try {
            return objectMapper.writeValueAsString(Map.of(
                    "source", "ADMIN_MANUAL_CONFIRM",
                    "operatorId", operator.getId(),
                    "operatorName", firstText(operator.getNickname(), operator.getUsername(), String.valueOf(operator.getId())),
                    "note", note == null ? "" : note,
                    "confirmedAt", new Date()
            ));
        } catch (JsonProcessingException exception) {
            return "ADMIN_MANUAL_CONFIRM operatorId=" + operator.getId();
        }
    }

    private String buildAlipayError(String code, String subCode, String subMsg) {
        String message = String.join(" | ",
                firstText(code, ""),
                firstText(subCode, ""),
                firstText(subMsg, ""));
        return limitText(message, 500);
    }

    private String safeAlipayMessage(String preferred, String fallback) {
        return firstText(preferred, fallback, "支付宝接口返回失败");
    }

    private String normalizeResourceType(String value) {
        String normalized = normalizeNullableText(value);
        return normalized == null ? null : normalized.toUpperCase(Locale.ROOT);
    }

    private String normalizeCouponCode(String value) {
        String normalized = normalizeNullableText(value);
        if (normalized == null) {
            return null;
        }
        String cleaned = normalized.toUpperCase(Locale.ROOT).replaceAll("\\s+", "");
        if (!cleaned.matches("^[A-Z0-9_-]{4,32}$")) {
            throw ApiException.badRequest("优惠码格式不正确");
        }
        return cleaned;
    }

    private String appendError(String currentError, String nextError) {
        String current = normalizeNullableText(currentError);
        String next = normalizeNullableText(nextError);
        if (current == null) {
            return limitText(next, 500);
        }
        if (next == null || current.contains(next)) {
            return limitText(current, 500);
        }
        return limitText(current + "；" + next, 500);
    }

    private String formatAmount(BigDecimal amount) {
        return amount == null ? "-" : amount.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private String firstText(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            String normalized = normalizeNullableText(value);
            if (normalized != null) {
                return normalized;
            }
        }
        return null;
    }

    private String normalizeNullableText(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String requireText(String value, String message) {
        String normalized = normalizeNullableText(value);
        if (normalized == null) {
            throw ApiException.badRequest(message);
        }
        return normalized;
    }

    private String limitText(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
