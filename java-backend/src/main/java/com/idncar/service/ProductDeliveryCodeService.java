package com.idncar.service;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.idncar.exception.ApiException;
import com.idncar.mapper.AdminOperationLogMapper;
import com.idncar.mapper.MailSendLogMapper;
import com.idncar.mapper.PaymentOrderMapper;
import com.idncar.mapper.ProductDeliveryCodeMapper;
import com.idncar.mapper.ProductMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.ImportProductDeliveryCodesRequest;
import com.idncar.model.dto.ImportProductDeliveryCodesResponse;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.ProductDeliveryCodeDto;
import com.idncar.model.dto.ProductDeliveryCodeStatsDto;
import com.idncar.model.entity.AdminOperationLog;
import com.idncar.model.entity.MailSendLog;
import com.idncar.model.entity.PaymentOrder;
import com.idncar.model.entity.Product;
import com.idncar.model.entity.ProductDeliveryCode;
import com.idncar.service.impl.MailBrandTemplateHelper;
import com.idncar.model.entity.User;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.Year;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.Date;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class ProductDeliveryCodeService {

    private static final Logger log = LoggerFactory.getLogger(ProductDeliveryCodeService.class);
    private static final String DELIVERY_TYPE_CDK_EMAIL = "CDK_EMAIL";
    private static final String STATUS_AVAILABLE = "AVAILABLE";
    private static final String STATUS_LOCKED = "LOCKED";
    private static final String STATUS_SENT = "SENT";
    private static final String STATUS_DISABLED = "DISABLED";
    private static final String MAIL_STATUS_SUCCESS = "SUCCESS";
    private static final String MAIL_STATUS_FAILED = "FAILED";
    private static final List<String> STATUSES = List.of(STATUS_AVAILABLE, STATUS_LOCKED, STATUS_SENT, STATUS_DISABLED);
    private static final int MAX_IMPORT_COUNT = 1000;
    private static final DateTimeFormatter BATCH_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    @Autowired
    private ProductDeliveryCodeMapper productDeliveryCodeMapper;

    @Autowired
    private ProductMapper productMapper;

    @Autowired
    private PaymentOrderMapper paymentOrderMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private AdminOperationLogMapper adminOperationLogMapper;

    @Autowired
    private MailSendLogMapper mailSendLogMapper;

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private ObjectProvider<JavaMailSender> mailSenderProvider;

    @Autowired
    private MailBrandTemplateHelper mailBrandTemplateHelper;

    @Value("${app.mail.from:}")
    private String mailFrom;

    @Value("${spring.mail.username:}")
    private String springMailUsername;

    @Value("${app.mail.mock-enabled:false}")
    private boolean mailMockEnabled;

    public PageResultDto<ProductDeliveryCodeDto> getAdminDeliveryCodes(Long adminUserId, Integer page, Integer size, String keyword, Long productId, String status) {
        userAccessService.requireAdmin(adminUserId);
        int safePage = page == null ? 1 : Math.max(1, page);
        int safeSize = size == null ? 10 : Math.max(1, Math.min(size, 100));

        QueryWrapper<ProductDeliveryCode> queryWrapper = buildAdminQuery(keyword, productId, status);
        queryWrapper.orderByDesc("create_time");
        Page<ProductDeliveryCode> result = productDeliveryCodeMapper.selectPage(new Page<>(safePage, safeSize), queryWrapper);
        return PageResultDto.of(toDtos(result.getRecords()), result.getTotal(), safePage, safeSize);
    }

    public ProductDeliveryCodeStatsDto getAdminDeliveryCodeStats(Long adminUserId) {
        userAccessService.requireAdmin(adminUserId);
        Long total = productDeliveryCodeMapper.selectCount(new QueryWrapper<>());
        Long available = productDeliveryCodeMapper.selectCount(new QueryWrapper<ProductDeliveryCode>().eq("status", STATUS_AVAILABLE));
        Long locked = productDeliveryCodeMapper.selectCount(new QueryWrapper<ProductDeliveryCode>().eq("status", STATUS_LOCKED));
        Long sent = productDeliveryCodeMapper.selectCount(new QueryWrapper<ProductDeliveryCode>().eq("status", STATUS_SENT));
        Long disabled = productDeliveryCodeMapper.selectCount(new QueryWrapper<ProductDeliveryCode>().eq("status", STATUS_DISABLED));
        return new ProductDeliveryCodeStatsDto(
                total == null ? 0 : total,
                available == null ? 0 : available,
                locked == null ? 0 : locked,
                sent == null ? 0 : sent,
                disabled == null ? 0 : disabled
        );
    }

    @Transactional(rollbackFor = Exception.class)
    public ImportProductDeliveryCodesResponse importDeliveryCodes(Long adminUserId, ImportProductDeliveryCodesRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);
        if (request == null) {
            throw ApiException.badRequest("缺少CDK导入参数");
        }
        Product product = requireProduct(request.getProductId());
        if (!"CDK_EMAIL".equalsIgnoreCase(product.getDeliveryType())) {
            throw ApiException.badRequest("请先将商品发货方式设置为虚拟CDK邮件");
        }

        List<String> parsedCodes = parseCodes(request.getContent());
        List<String> existingCodes = productDeliveryCodeMapper.selectList(new QueryWrapper<ProductDeliveryCode>()
                        .eq("product_id", product.getId())
                        .in("code", parsedCodes))
                .stream()
                .map(ProductDeliveryCode::getCode)
                .collect(Collectors.toList());
        Set<String> existingSet = existingCodes.stream().collect(Collectors.toSet());
        List<String> newCodes = parsedCodes.stream()
                .filter(code -> !existingSet.contains(code))
                .collect(Collectors.toList());
        String batchNo = "DC" + LocalDateTime.now().format(BATCH_FORMATTER);
        String note = limitText(normalizeNullableText(request.getNote()), 300);

        for (String code : newCodes) {
            ProductDeliveryCode deliveryCode = new ProductDeliveryCode();
            deliveryCode.setProductId(product.getId());
            deliveryCode.setCode(code);
            deliveryCode.setStatus(STATUS_AVAILABLE);
            deliveryCode.setCreatedBy(operator.getId());
            deliveryCode.setBatchNo(batchNo);
            deliveryCode.setNote(note);
            productDeliveryCodeMapper.insert(deliveryCode);
        }

        List<ProductDeliveryCode> created = newCodes.isEmpty()
                ? Collections.emptyList()
                : productDeliveryCodeMapper.selectList(new QueryWrapper<ProductDeliveryCode>()
                .eq("batch_no", batchNo)
                .orderByAsc("id"));
        if (!created.isEmpty()) {
            logOperation(operator, "PRODUCT_DELIVERY_CODE_IMPORTED", product.getId(), product.getTitle(),
                    "为商品导入CDK " + created.size() + " 个，批次：" + batchNo);
        }
        return new ImportProductDeliveryCodesResponse(batchNo, created.size(), parsedCodes.size() - created.size(), toDtos(created));
    }

    public String exportAdminDeliveryCodesCsv(Long adminUserId, String keyword, Long productId, String status) {
        userAccessService.requireAdmin(adminUserId);
        List<ProductDeliveryCodeDto> records = toDtos(productDeliveryCodeMapper.selectList(buildAdminQuery(keyword, productId, status)
                .orderByDesc("create_time")));
        StringBuilder csv = new StringBuilder("\ufeff");
        csv.append("CDK,商品,状态,绑定订单,绑定用户,锁定时间,发送时间,批次,备注,创建时间\n");
        for (ProductDeliveryCodeDto record : records) {
            csv.append(csvCell(record.getCode())).append(',')
                    .append(csvCell(record.getProductTitle())).append(',')
                    .append(csvCell(deliveryCodeStatusLabel(record.getStatus()))).append(',')
                    .append(csvCell(record.getOrderNo())).append(',')
                    .append(csvCell(record.getAssignedToName())).append(',')
                    .append(csvCell(record.getAssignedAt())).append(',')
                    .append(csvCell(record.getSentAt())).append(',')
                    .append(csvCell(record.getBatchNo())).append(',')
                    .append(csvCell(record.getNote())).append(',')
                    .append(csvCell(record.getCreateTime())).append('\n');
        }
        return csv.toString();
    }

    public void requireAvailableDeliveryCode(Product product) {
        if (product == null || !DELIVERY_TYPE_CDK_EMAIL.equalsIgnoreCase(product.getDeliveryType())) {
            return;
        }
        Long availableCount = productDeliveryCodeMapper.selectCount(new QueryWrapper<ProductDeliveryCode>()
                .eq("product_id", product.getId())
                .eq("status", STATUS_AVAILABLE));
        if (availableCount == null || availableCount <= 0) {
            throw ApiException.badRequest("该虚拟商品CDK库存不足，请联系管理员补货");
        }
    }

    public String fulfillPaidOrder(PaymentOrder order) {
        if (order == null || order.getResourceId() == null) {
            return null;
        }
        Product product = productMapper.selectById(order.getResourceId());
        if (product == null) {
            return null;
        }

        User buyer = order.getPayerUserId() == null ? null : userMapper.selectById(order.getPayerUserId());
        String buyerEmail = firstText(order.getDeliveryEmail(), buyer == null ? null : buyer.getEmail());
        if (buyerEmail == null) {
            return "订单收货邮箱缺失，商品发货邮件未发送";
        }
        if (!DELIVERY_TYPE_CDK_EMAIL.equalsIgnoreCase(product.getDeliveryType())) {
            return sendDeliveryEmail(product, order.getOutTradeNo(), null, buyerEmail);
        }

        ProductDeliveryCode deliveryCode = findOrderDeliveryCode(product.getId(), order.getOutTradeNo());
        if (deliveryCode == null) {
            deliveryCode = lockAvailableDeliveryCode(product.getId(), order.getPayerUserId(), order.getOutTradeNo());
        }
        if (deliveryCode == null) {
            return "CDK库存不足，支付成功后需要后台补充库存并人工处理";
        }
        if (STATUS_SENT.equalsIgnoreCase(deliveryCode.getStatus())) {
            return null;
        }
        if (!STATUS_LOCKED.equalsIgnoreCase(deliveryCode.getStatus())) {
            return "CDK发货状态异常，当前状态：" + deliveryCode.getStatus();
        }

        String mailError = sendDeliveryEmail(product, order.getOutTradeNo(), deliveryCode, buyerEmail);
        if (mailError != null) {
            return mailError;
        }

        Date now = new Date();
        int sent = productDeliveryCodeMapper.update(null, new UpdateWrapper<ProductDeliveryCode>()
                .set("status", STATUS_SENT)
                .set("sent_at", now)
                .set("update_time", now)
                .eq("id", deliveryCode.getId())
                .eq("status", STATUS_LOCKED));
        if (sent <= 0) {
            return "CDK邮件已发送，但发货状态更新失败，需要后台核对";
        }
        return null;
    }

    @Transactional(rollbackFor = Exception.class)
    public void resendPaidOrder(PaymentOrder order) {
        if (order == null || order.getResourceId() == null) {
            throw ApiException.badRequest("订单未关联商品，不能重新发货");
        }
        Product product = requireProduct(order.getResourceId());
        User buyer = order.getPayerUserId() == null ? null : userMapper.selectById(order.getPayerUserId());
        String buyerEmail = firstText(order.getDeliveryEmail(), buyer == null ? null : buyer.getEmail());
        if (buyerEmail == null) {
            throw ApiException.badRequest("订单收货邮箱缺失，不能重新发货");
        }

        if (!DELIVERY_TYPE_CDK_EMAIL.equalsIgnoreCase(product.getDeliveryType())) {
            String mailError = sendDeliveryEmail(product, order.getOutTradeNo(), null, buyerEmail);
            if (mailError != null) {
                throw ApiException.badGateway(mailError);
            }
            return;
        }

        ProductDeliveryCode deliveryCode = findOrderDeliveryCode(product.getId(), order.getOutTradeNo());
        if (deliveryCode == null) {
            deliveryCode = lockAvailableDeliveryCode(
                    product.getId(), order.getPayerUserId(), order.getOutTradeNo());
        }
        if (deliveryCode == null) {
            throw ApiException.badRequest("CDK库存不足，请补充库存后重试");
        }
        if (!STATUS_LOCKED.equalsIgnoreCase(deliveryCode.getStatus())
                && !STATUS_SENT.equalsIgnoreCase(deliveryCode.getStatus())) {
            throw ApiException.badRequest("该订单CDK状态不支持重新发货");
        }
        sendAndMarkDeliveryCodeSent(product, order.getOutTradeNo(), deliveryCode, buyerEmail);
    }

    @Transactional(rollbackFor = Exception.class)
    public ProductDeliveryCodeDto resendDeliveryCode(Long adminUserId, Long codeId) {
        User operator = userAccessService.requireAdmin(adminUserId);
        ProductDeliveryCode deliveryCode = requireDeliveryCode(codeId);
        if (!STATUS_LOCKED.equalsIgnoreCase(deliveryCode.getStatus()) && !STATUS_SENT.equalsIgnoreCase(deliveryCode.getStatus())) {
            throw ApiException.badRequest("只有已锁定或已发送的CDK可以补发邮件");
        }
        String orderNo = requireText(deliveryCode.getOrderNo(), "CDK未绑定订单，不能补发");
        Product product = requireProduct(deliveryCode.getProductId());
        PaymentOrder order = findPaymentOrder(orderNo);
        User buyer = deliveryCode.getAssignedTo() == null ? null : userMapper.selectById(deliveryCode.getAssignedTo());
        String buyerEmail = firstText(order == null ? null : order.getDeliveryEmail(), buyer == null ? null : buyer.getEmail());
        if (buyerEmail == null) {
            throw ApiException.badRequest("订单收货邮箱缺失，不能补发");
        }

        sendAndMarkDeliveryCodeSent(product, orderNo, deliveryCode, buyerEmail);
        ProductDeliveryCode saved = productDeliveryCodeMapper.selectById(codeId);
        logOperation(operator, "PRODUCT_DELIVERY_CODE_RESENT", saved.getId(), saved.getCode(),
                "补发CDK邮件，订单：" + orderNo);
        return toDtos(List.of(saved)).get(0);
    }

    private void sendAndMarkDeliveryCodeSent(Product product, String orderNo,
                                               ProductDeliveryCode deliveryCode, String buyerEmail) {
        String mailError = sendDeliveryEmail(product, orderNo, deliveryCode, buyerEmail);
        if (mailError != null) {
            throw ApiException.badGateway(mailError);
        }

        Date now = new Date();
        int updated = productDeliveryCodeMapper.update(null, new UpdateWrapper<ProductDeliveryCode>()
                .set("status", STATUS_SENT)
                .set("sent_at", now)
                .set("update_time", now)
                .eq("id", deliveryCode.getId())
                .in("status", List.of(STATUS_LOCKED, STATUS_SENT)));
        if (updated <= 0) {
            throw ApiException.badGateway("发货邮件已发送，但CDK状态更新失败，请后台核对");
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public ProductDeliveryCodeDto disableDeliveryCode(Long adminUserId, Long codeId) {
        User operator = userAccessService.requireAdmin(adminUserId);
        ProductDeliveryCode deliveryCode = requireDeliveryCode(codeId);
        if (STATUS_SENT.equalsIgnoreCase(deliveryCode.getStatus())) {
            throw ApiException.badRequest("已发送的CDK不能作废");
        }
        if (STATUS_LOCKED.equalsIgnoreCase(deliveryCode.getStatus())) {
            throw ApiException.badRequest("CDK已被订单锁定，需先处理对应订单");
        }
        if (STATUS_DISABLED.equalsIgnoreCase(deliveryCode.getStatus())) {
            return toDto(deliveryCode, null, null);
        }
        deliveryCode.setStatus(STATUS_DISABLED);
        deliveryCode.setUpdateTime(new Date());
        productDeliveryCodeMapper.updateById(deliveryCode);
        ProductDeliveryCode saved = productDeliveryCodeMapper.selectById(codeId);
        logOperation(operator, "PRODUCT_DELIVERY_CODE_DISABLED", saved.getId(), saved.getCode(), "作废CDK库存");
        return toDtos(List.of(saved)).get(0);
    }

    @Transactional(rollbackFor = Exception.class)
    public List<ProductDeliveryCodeDto> disableDeliveryCodeBatch(Long adminUserId, String batchNo) {
        User operator = userAccessService.requireAdmin(adminUserId);
        String normalizedBatchNo = requireText(batchNo, "批次号不能为空");
        List<ProductDeliveryCode> batchCodes = productDeliveryCodeMapper.selectList(new QueryWrapper<ProductDeliveryCode>()
                .eq("batch_no", normalizedBatchNo)
                .orderByAsc("id"));
        if (batchCodes.isEmpty()) {
            throw ApiException.notFound("CDK批次不存在");
        }
        Long lockedCount = productDeliveryCodeMapper.selectCount(new QueryWrapper<ProductDeliveryCode>()
                .eq("batch_no", normalizedBatchNo)
                .eq("status", STATUS_LOCKED));
        if (lockedCount != null && lockedCount > 0) {
            throw ApiException.badRequest("当前批次仍有CDK被订单锁定，请先处理对应订单");
        }
        int disabledCount = productDeliveryCodeMapper.update(null, new UpdateWrapper<ProductDeliveryCode>()
                .set("status", STATUS_DISABLED)
                .set("update_time", new Date())
                .eq("batch_no", normalizedBatchNo)
                .eq("status", STATUS_AVAILABLE));
        List<ProductDeliveryCode> saved = productDeliveryCodeMapper.selectList(new QueryWrapper<ProductDeliveryCode>()
                .eq("batch_no", normalizedBatchNo)
                .orderByAsc("id"));
        logOperation(operator, "PRODUCT_DELIVERY_CODE_BATCH_DISABLED", null, normalizedBatchNo,
                "整批作废CDK，批次：" + normalizedBatchNo + "，作废 " + disabledCount + " 个");
        return toDtos(saved);
    }

    private QueryWrapper<ProductDeliveryCode> buildAdminQuery(String keyword, Long productId, String status) {
        QueryWrapper<ProductDeliveryCode> queryWrapper = new QueryWrapper<>();
        if (productId != null && productId > 0) {
            queryWrapper.eq("product_id", productId);
        }
        String normalizedStatus = normalizeNullableText(status);
        if (normalizedStatus != null && !"ALL".equalsIgnoreCase(normalizedStatus)) {
            String upperStatus = normalizedStatus.toUpperCase(Locale.ROOT);
            if (!STATUSES.contains(upperStatus)) {
                throw ApiException.badRequest("CDK状态筛选不正确");
            }
            queryWrapper.eq("status", upperStatus);
        }
        String normalizedKeyword = normalizeNullableText(keyword);
        if (normalizedKeyword != null) {
            queryWrapper.and(wrapper -> wrapper.like("code", normalizedKeyword)
                    .or()
                    .like("batch_no", normalizedKeyword)
                    .or()
                    .like("order_no", normalizedKeyword)
                    .or()
                    .like("note", normalizedKeyword));
        }
        return queryWrapper;
    }

    private ProductDeliveryCode findOrderDeliveryCode(Long productId, String outTradeNo) {
        String normalizedOrderNo = normalizeNullableText(outTradeNo);
        if (productId == null || normalizedOrderNo == null) {
            return null;
        }
        return productDeliveryCodeMapper.selectOne(new QueryWrapper<ProductDeliveryCode>()
                .eq("product_id", productId)
                .eq("order_no", normalizedOrderNo)
                .last("LIMIT 1"));
    }

    private PaymentOrder findPaymentOrder(String outTradeNo) {
        String normalizedOrderNo = normalizeNullableText(outTradeNo);
        if (normalizedOrderNo == null) {
            return null;
        }
        return paymentOrderMapper.selectOne(new QueryWrapper<PaymentOrder>()
                .eq("out_trade_no", normalizedOrderNo)
                .last("LIMIT 1"));
    }

    private ProductDeliveryCode lockAvailableDeliveryCode(Long productId, Long buyerUserId, String outTradeNo) {
        String normalizedOrderNo = normalizeNullableText(outTradeNo);
        if (productId == null || buyerUserId == null || normalizedOrderNo == null) {
            return null;
        }
        for (int attempt = 0; attempt < 5; attempt++) {
            ProductDeliveryCode candidate = productDeliveryCodeMapper.selectOne(new QueryWrapper<ProductDeliveryCode>()
                    .eq("product_id", productId)
                    .eq("status", STATUS_AVAILABLE)
                    .orderByAsc("id")
                    .last("LIMIT 1"));
            if (candidate == null) {
                return null;
            }

            Date now = new Date();
            int locked = productDeliveryCodeMapper.update(null, new UpdateWrapper<ProductDeliveryCode>()
                    .set("status", STATUS_LOCKED)
                    .set("assigned_to", buyerUserId)
                    .set("order_no", normalizedOrderNo)
                    .set("assigned_at", now)
                    .set("update_time", now)
                    .eq("id", candidate.getId())
                    .eq("status", STATUS_AVAILABLE));
            if (locked > 0) {
                return productDeliveryCodeMapper.selectById(candidate.getId());
            }
        }
        return null;
    }

    private String sendDeliveryEmail(Product product, String orderNo, ProductDeliveryCode deliveryCode, String buyerEmail) {
        boolean cdkDelivery = deliveryCode != null;
        String subject = buildDeliveryEmailSubject(product);
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            String error = cdkDelivery
                    ? "邮件服务未配置完成，CDK已锁定待后台发送"
                    : "邮件服务未配置完成，商品发货邮件待后台发送";
            recordMailSendLog(product, orderNo, deliveryCode, buyerEmail, subject, MAIL_STATUS_FAILED, error);
            return error;
        }
        if (mailMockEnabled) {
            String error = cdkDelivery
                    ? "当前环境仍处于mock发信模式，CDK已锁定待后台发送"
                    : "当前环境仍处于mock发信模式，商品发货邮件待后台发送";
            recordMailSendLog(product, orderNo, deliveryCode, buyerEmail, subject, MAIL_STATUS_FAILED, error);
            return error;
        }
        String senderAddress = resolveMailFromAddress();
        if (senderAddress == null) {
            String error = cdkDelivery
                    ? "发件邮箱未配置，CDK已锁定待后台发送"
                    : "发件邮箱未配置，商品发货邮件待后台发送";
            recordMailSendLog(product, orderNo, deliveryCode, buyerEmail, subject, MAIL_STATUS_FAILED, error);
            return error;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(senderAddress, "IDNCAR");
            helper.setTo(buyerEmail);
            helper.setSubject(subject);
            helper.setText(buildDeliveryEmailHtml(product, orderNo, deliveryCode), true);
            mailBrandTemplateHelper.addInlineLogoIfNeeded(helper);
            mailSender.send(message);
            recordMailSendLog(product, orderNo, deliveryCode, buyerEmail, subject, MAIL_STATUS_SUCCESS, null);
            return null;
        } catch (Exception exception) {
            log.warn("Delivery email failed: orderNo={}, codeId={}, email={}, error={}",
                    orderNo, deliveryCode == null ? null : deliveryCode.getId(), buyerEmail, exception.getMessage());
            String error = cdkDelivery
                    ? "CDK邮件发送失败，CDK已锁定待后台重试"
                    : "商品发货邮件发送失败，待后台重试";
            recordMailSendLog(product, orderNo, deliveryCode, buyerEmail, subject, MAIL_STATUS_FAILED,
                    error + "：" + exception.getMessage());
            return error;
        }
    }

    private void recordMailSendLog(Product product, String orderNo, ProductDeliveryCode deliveryCode,
                                   String buyerEmail, String subject, String status, String errorMessage) {
        try {
            MailSendLog mailLog = new MailSendLog();
            mailLog.setMailType(deliveryCode == null ? "PRODUCT_DELIVERY" : "CDK_DELIVERY");
            mailLog.setTriggerType("DELIVERY");
            mailLog.setOrderNo(limitText(normalizeNullableText(orderNo), 64));
            mailLog.setProductId(product == null ? null : product.getId());
            mailLog.setProductTitle(limitText(product == null ? null : product.getTitle(), 160));
            mailLog.setDeliveryCodeId(deliveryCode == null ? null : deliveryCode.getId());
            mailLog.setRecipientEmail(limitText(normalizeNullableText(buyerEmail), 120));
            mailLog.setSubject(limitText(normalizeNullableText(subject), 200));
            mailLog.setStatus(status);
            mailLog.setErrorMessage(limitText(normalizeNullableText(errorMessage), 600));
            mailLog.setCreateTime(new Date());
            mailSendLogMapper.insert(mailLog);
        } catch (Exception exception) {
            log.warn("Failed to record delivery email log: orderNo={}, email={}, error={}",
                    orderNo, buyerEmail, exception.getMessage());
        }
    }

    private String resolveMailFromAddress() {
        String configuredFrom = normalizeNullableText(mailFrom);
        if (configuredFrom != null) {
            return configuredFrom;
        }
        return normalizeNullableText(springMailUsername);
    }

    private String buildDeliveryEmailSubject(Product product) {
        return limitText("IDNCAR 商品发货 - " + firstText(product.getTitle(), "商品"), 120);
    }

    private String buildDeliveryEmailHtml(Product product, String orderNo, ProductDeliveryCode deliveryCode) {
        String title = escapeHtml(product.getTitle());
        String safeOrderNo = escapeHtml(orderNo);
        boolean cdkDelivery = deliveryCode != null;
        String instructions = htmlLines(cdkDelivery
                ? firstText(product.getDeliveryInstructions(), "暂无使用教程，请联系管理员补充。")
                : firstText(product.getDeliveryInstructions(), product.getDescription(), product.getSubtitle(),
                        "商品已经领取成功。如需进一步获取交付内容，请携带订单号联系管理员。"));
        String preheader = cdkDelivery
                ? "您的 IDNCAR 虚拟商品已发货，CDK 已在邮件中。"
                : "您的 IDNCAR 商品已经领取成功，交付内容已在邮件中。";
        String intro = cdkDelivery
                ? "您好，您在 IDNCAR 购买的虚拟商品已经完成发货。请妥善保存下方 CDK，并按照使用教程完成兑换。"
                : "您好，您在 IDNCAR 购买或领取的商品已经完成发货。请查看并妥善保存下方交付内容。";
        String deliveryContent = cdkDelivery
                ? """
                  <div style="margin:24px 0 26px;padding:24px;border-radius:8px;background:#f8fbff;border:1px solid #cfe0f5;">
                    <div style="font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#58708d;">Delivery Code</div>
                    <div style="margin-top:12px;font-family:Consolas,Menlo,monospace;font-size:24px;font-weight:800;line-height:1.5;color:#102033;word-break:break-all;">%s</div>
                  </div>
                  <div style="font-size:16px;font-weight:800;color:#102033;">使用教程</div>
                  """.formatted(escapeHtml(deliveryCode.getCode()))
                : """
                  <div style="margin-top:24px;font-size:16px;font-weight:800;color:#102033;">商品交付内容</div>
                  """;
        String supportText = cdkDelivery
                ? "如果 CDK 无法使用，请携带订单号联系管理员处理。"
                : "如果交付内容存在问题，请携带订单号联系管理员处理。";
        String brandMark = mailBrandTemplateHelper.buildBrandMarkHtml();
        String siteUrl = escapeHtml(mailBrandTemplateHelper.siteUrl());
        String ordersUrl = escapeHtml(mailBrandTemplateHelper.sitePath("/orders"));
        int currentYear = Year.now().getValue();
        return """
                <!DOCTYPE html>
                <html lang="zh-CN">
                <head>
                  <meta charset="UTF-8" />
                  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                  <title>IDNCAR 商品发货</title>
                </head>
                <body style="margin:0;padding:0;background:#eef3f8;font-family:'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#102033;">
                  <div style="display:none;max-height:0;overflow:hidden;color:transparent;">%s</div>
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%%" style="background:#eef3f8;padding:32px 12px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" cellpadding="0" cellspacing="0" width="100%%" style="max-width:680px;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #d9e2ec;box-shadow:0 18px 48px rgba(16,32,51,0.12);">
                          <tr>
                            <td style="padding:28px 32px;background:#102033;color:#ffffff;">
                              <table role="presentation" cellpadding="0" cellspacing="0" width="100%%">
                                <tr>
                                  <td style="vertical-align:middle;">%s</td>
                                  <td align="right" style="vertical-align:middle;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#a9b8c9;">Secure Delivery</td>
                                </tr>
                              </table>
                              <div style="margin-top:28px;font-size:13px;line-height:1.7;color:#b8c7d8;">IDNCAR 商品发货通知</div>
                              <div style="margin-top:8px;font-size:28px;font-weight:800;line-height:1.32;color:#ffffff;">%s</div>
                              <div style="margin-top:12px;font-size:14px;line-height:1.8;color:#d9e2ec;">订单号：<span style="font-family:Consolas,Menlo,monospace;">%s</span></div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:34px 32px 30px;">
                              <div style="font-size:15px;line-height:1.9;color:#475569;">%s</div>
                              %s
                              <div style="margin-top:12px;padding:18px 20px;border-radius:8px;background:#f9fafb;border:1px solid #e2e8f0;font-size:14px;line-height:1.9;color:#334155;">%s</div>
                              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:26px;">
                                <tr>
                                  <td style="border-radius:6px;background:#1d4ed8;">
                                    <a href="%s" target="_blank" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">查看我的订单</a>
                                  </td>
                                  <td style="padding-left:14px;font-size:13px;line-height:1.8;color:#64748b;">
                                    官网：<a href="%s" target="_blank" style="color:#1d4ed8;text-decoration:none;">%s</a>
                                  </td>
                                </tr>
                              </table>
                              <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:13px;line-height:1.9;color:#64748b;">
                                %s
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:20px 32px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.8;color:#8291a3;text-align:center;">
                              © %d IDNCAR. 这是一封系统自动发送的发货邮件，请勿直接回复。
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </body>
                </html>
                """.formatted(preheader, brandMark, title, safeOrderNo, intro, deliveryContent, instructions,
                ordersUrl, siteUrl, siteUrl, supportText, currentYear);
    }

    private List<String> parseCodes(String content) {
        String normalizedContent = requireText(content, "请粘贴CDK内容");
        LinkedHashSet<String> uniqueCodes = new LinkedHashSet<>();
        String[] candidates = normalizedContent.split("[\\s,，;；、]+");
        for (String candidate : candidates) {
            String code = normalizeNullableText(candidate);
            if (code == null) {
                continue;
            }
            if (code.length() > 500) {
                throw ApiException.badRequest("单个CDK不能超过500个字符");
            }
            uniqueCodes.add(code);
            if (uniqueCodes.size() > MAX_IMPORT_COUNT) {
                throw ApiException.badRequest("单次最多导入 " + MAX_IMPORT_COUNT + " 个CDK");
            }
        }
        if (uniqueCodes.isEmpty()) {
            throw ApiException.badRequest("没有可导入的CDK");
        }
        return List.copyOf(uniqueCodes);
    }

    private Product requireProduct(Long productId) {
        if (productId == null || productId <= 0) {
            throw ApiException.badRequest("商品ID不正确");
        }
        Product product = productMapper.selectById(productId);
        if (product == null) {
            throw ApiException.notFound("商品不存在");
        }
        return product;
    }

    private ProductDeliveryCode requireDeliveryCode(Long codeId) {
        if (codeId == null || codeId <= 0) {
            throw ApiException.badRequest("CDK ID不正确");
        }
        ProductDeliveryCode deliveryCode = productDeliveryCodeMapper.selectById(codeId);
        if (deliveryCode == null) {
            throw ApiException.notFound("CDK不存在");
        }
        return deliveryCode;
    }

    private List<ProductDeliveryCodeDto> toDtos(List<ProductDeliveryCode> deliveryCodes) {
        if (deliveryCodes == null || deliveryCodes.isEmpty()) {
            return Collections.emptyList();
        }
        List<Long> productIds = deliveryCodes.stream()
                .map(ProductDeliveryCode::getProductId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, Product> products = productIds.isEmpty()
                ? Collections.emptyMap()
                : productMapper.selectBatchIds(productIds).stream()
                .collect(Collectors.toMap(Product::getId, Function.identity()));
        List<Long> assignedUserIds = deliveryCodes.stream()
                .map(ProductDeliveryCode::getAssignedTo)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, User> users = assignedUserIds.isEmpty()
                ? Collections.emptyMap()
                : userMapper.selectBatchIds(assignedUserIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return deliveryCodes.stream()
                .map(code -> toDto(code, products.get(code.getProductId()), users.get(code.getAssignedTo())))
                .collect(Collectors.toList());
    }

    private ProductDeliveryCodeDto toDto(ProductDeliveryCode deliveryCode, Product product, User assignedUser) {
        String productTitle = product == null ? null : product.getTitle();
        String assignedToName = assignedUser == null ? null : (normalizeNullableText(assignedUser.getNickname()) == null ? assignedUser.getUsername() : assignedUser.getNickname());
        return ProductDeliveryCodeDto.fromEntity(deliveryCode, productTitle, assignedToName);
    }

    private void logOperation(User operator, String actionType, Long targetId, String targetName, String detail) {
        AdminOperationLog log = new AdminOperationLog();
        log.setOperatorId(operator.getId());
        log.setOperatorRole(operator.getRole());
        log.setActionType(actionType);
        log.setTargetType("PRODUCT_DELIVERY_CODE");
        log.setTargetId(targetId);
        log.setTargetName(limitText(normalizeNullableText(targetName), 160));
        log.setDetail(limitText(normalizeNullableText(detail), 500));
        log.setCreateTime(new Date());
        adminOperationLogMapper.insert(log);
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

    private String htmlLines(String value) {
        return escapeHtml(value).replace("\r\n", "\n").replace("\n", "<br/>");
    }

    private String escapeHtml(String value) {
        if (value == null) {
            return "";
        }
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String deliveryCodeStatusLabel(String value) {
        if (STATUS_AVAILABLE.equalsIgnoreCase(value)) return "可发货";
        if (STATUS_LOCKED.equalsIgnoreCase(value)) return "已锁定";
        if (STATUS_SENT.equalsIgnoreCase(value)) return "已发送";
        if (STATUS_DISABLED.equalsIgnoreCase(value)) return "已作废";
        return value == null ? "" : value;
    }

    private String csvCell(String value) {
        String normalized = value == null ? "" : value.replace("\"", "\"\"");
        return "\"" + normalized + "\"";
    }

    private String limitText(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
