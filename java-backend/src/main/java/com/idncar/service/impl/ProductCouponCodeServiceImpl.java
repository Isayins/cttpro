package com.idncar.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.idncar.exception.ApiException;
import com.idncar.mapper.AdminOperationLogMapper;
import com.idncar.mapper.ProductCouponCodeMapper;
import com.idncar.mapper.ProductMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.CreateProductCouponCodesRequest;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.ProductCouponCodeDto;
import com.idncar.model.dto.ProductCouponPreviewDto;
import com.idncar.model.dto.ProductCouponStatsDto;
import com.idncar.model.entity.AdminOperationLog;
import com.idncar.model.entity.PaymentOrder;
import com.idncar.model.entity.Product;
import com.idncar.model.entity.ProductCouponCode;
import com.idncar.model.entity.User;
import com.idncar.service.ProductCouponCodeService;
import com.idncar.service.ProductService;
import com.idncar.service.UserAccessService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.text.SimpleDateFormat;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ProductCouponCodeServiceImpl implements ProductCouponCodeService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_LOCKED = "LOCKED";
    private static final String STATUS_USED = "USED";
    private static final String STATUS_DISABLED = "DISABLED";
    private static final String STATUS_EXPIRED = "EXPIRED";
    private static final String TYPE_AMOUNT = "AMOUNT";
    private static final String TYPE_PERCENT = "PERCENT";
    private static final BigDecimal MIN_PAYABLE_AMOUNT = new BigDecimal("0.01");
    private static final BigDecimal MAX_DISCOUNT_AMOUNT = new BigDecimal("99999999.99");
    private static final int MAX_GENERATE_COUNT = 500;
    private static final String CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final DateTimeFormatter BATCH_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    @Autowired
    private ProductCouponCodeMapper productCouponCodeMapper;

    @Autowired
    private ProductMapper productMapper;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private AdminOperationLogMapper adminOperationLogMapper;

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private ProductService productService;

    @Override
    public PageResultDto<ProductCouponCodeDto> getAdminCouponCodes(Long adminUserId, Integer page, Integer size, String keyword, Long productId, String status) {
        userAccessService.requireAdmin(adminUserId);
        releaseExpiredCouponLocks();
        int safePage = page == null ? 1 : Math.max(1, page);
        int safeSize = size == null ? 10 : Math.max(1, Math.min(size, 100));

        QueryWrapper<ProductCouponCode> queryWrapper = buildAdminQuery(keyword, productId, status);
        queryWrapper.orderByDesc("create_time");

        Page<ProductCouponCode> result = productCouponCodeMapper.selectPage(new Page<>(safePage, safeSize), queryWrapper);
        return PageResultDto.of(toDtos(result.getRecords()), result.getTotal(), safePage, safeSize);
    }

    @Override
    public ProductCouponStatsDto getAdminCouponStats(Long adminUserId) {
        userAccessService.requireAdmin(adminUserId);
        releaseExpiredCouponLocks();
        Date now = new Date();
        Long total = productCouponCodeMapper.selectCount(new QueryWrapper<>());
        Long active = productCouponCodeMapper.selectCount(new QueryWrapper<ProductCouponCode>()
                .eq("status", STATUS_ACTIVE)
                .and(wrapper -> wrapper.isNull("expires_at").or().gt("expires_at", now)));
        Long locked = productCouponCodeMapper.selectCount(new QueryWrapper<ProductCouponCode>().eq("status", STATUS_LOCKED));
        Long used = productCouponCodeMapper.selectCount(new QueryWrapper<ProductCouponCode>().eq("status", STATUS_USED));
        Long disabled = productCouponCodeMapper.selectCount(new QueryWrapper<ProductCouponCode>().eq("status", STATUS_DISABLED));
        Long expired = productCouponCodeMapper.selectCount(new QueryWrapper<ProductCouponCode>()
                .eq("status", STATUS_ACTIVE)
                .isNotNull("expires_at")
                .le("expires_at", now));
        return new ProductCouponStatsDto(
                total == null ? 0L : total,
                active == null ? 0L : active,
                locked == null ? 0L : locked,
                used == null ? 0L : used,
                disabled == null ? 0L : disabled,
                expired == null ? 0L : expired
        );
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<ProductCouponCodeDto> createCouponCodes(Long adminUserId, CreateProductCouponCodesRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);
        if (request == null) {
            throw ApiException.badRequest("缺少优惠码生成参数");
        }
        Product product = requireProduct(request.getProductId());
        int count = normalizeCount(request.getCount());
        String discountType = normalizeDiscountType(request.getDiscountType());
        BigDecimal discountValue = normalizeDiscountValue(discountType, request.getDiscountValue());
        Date expiresAt = resolveExpiresAt(request.getExpiresInDays());
        String prefix = normalizePrefix(request.getPrefix());
        String note = limitText(normalizeNullableText(request.getNote()), 300);
        String batchNo = "PC" + LocalDateTime.now().format(BATCH_FORMATTER);

        for (int index = 0; index < count; index += 1) {
            ProductCouponCode couponCode = new ProductCouponCode();
            couponCode.setCode(generateUniqueCode(prefix));
            couponCode.setProductId(product.getId());
            couponCode.setDiscountType(discountType);
            couponCode.setDiscountValue(discountValue);
            couponCode.setStatus(STATUS_ACTIVE);
            couponCode.setCreatedBy(operator.getId());
            couponCode.setExpiresAt(expiresAt);
            couponCode.setBatchNo(batchNo);
            couponCode.setNote(note);
            productCouponCodeMapper.insert(couponCode);
        }

        List<ProductCouponCode> created = productCouponCodeMapper.selectList(new QueryWrapper<ProductCouponCode>()
                .eq("batch_no", batchNo)
                .orderByAsc("id"));
        logOperation(operator, "PRODUCT_COUPON_CREATED", product.getId(), product.getTitle(),
                "为商品批量生成优惠码 " + created.size() + " 个，批次：" + batchNo);
        return toDtos(created);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ProductCouponCodeDto disableCouponCode(Long adminUserId, Long couponCodeId) {
        User operator = userAccessService.requireAdmin(adminUserId);
        releaseExpiredCouponLocks();
        ProductCouponCode couponCode = requireCouponCode(couponCodeId);
        if (STATUS_USED.equalsIgnoreCase(couponCode.getStatus())) {
            throw ApiException.badRequest("已使用的优惠码不能作废");
        }
        if (STATUS_LOCKED.equalsIgnoreCase(couponCode.getStatus())) {
            throw ApiException.badRequest("优惠码已被待支付订单锁定，请先关闭对应订单");
        }
        if (STATUS_DISABLED.equalsIgnoreCase(couponCode.getStatus())) {
            return toDto(couponCode);
        }

        couponCode.setStatus(STATUS_DISABLED);
        couponCode.setUpdateTime(new Date());
        productCouponCodeMapper.updateById(couponCode);
        ProductCouponCode saved = productCouponCodeMapper.selectById(couponCodeId);
        logOperation(operator, "PRODUCT_COUPON_DISABLED", saved.getId(), saved.getCode(), "作废优惠码");
        return toDto(saved);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public List<ProductCouponCodeDto> disableCouponBatch(Long adminUserId, String batchNo) {
        User operator = userAccessService.requireAdmin(adminUserId);
        releaseExpiredCouponLocks();
        String normalizedBatchNo = requireText(batchNo, "批次号不能为空");

        List<ProductCouponCode> batchCodes = productCouponCodeMapper.selectList(new QueryWrapper<ProductCouponCode>()
                .eq("batch_no", normalizedBatchNo)
                .orderByAsc("id"));
        if (batchCodes.isEmpty()) {
            throw ApiException.notFound("优惠码批次不存在");
        }

        Long lockedCount = productCouponCodeMapper.selectCount(new QueryWrapper<ProductCouponCode>()
                .eq("batch_no", normalizedBatchNo)
                .eq("status", STATUS_LOCKED));
        if (lockedCount != null && lockedCount > 0) {
            throw ApiException.badRequest("当前批次仍有优惠码被待支付订单锁定，请先关闭或等待订单过期");
        }

        int disabledCount = productCouponCodeMapper.update(null, new UpdateWrapper<ProductCouponCode>()
                .set("status", STATUS_DISABLED)
                .set("update_time", new Date())
                .eq("batch_no", normalizedBatchNo)
                .eq("status", STATUS_ACTIVE));
        List<ProductCouponCode> saved = productCouponCodeMapper.selectList(new QueryWrapper<ProductCouponCode>()
                .eq("batch_no", normalizedBatchNo)
                .orderByAsc("id"));
        logOperation(operator, "PRODUCT_COUPON_BATCH_DISABLED", null, normalizedBatchNo,
                "整批作废优惠码，批次：" + normalizedBatchNo + "，作废 " + disabledCount + " 个");
        return toDtos(saved);
    }

    @Override
    public String exportAdminCouponCodesCsv(Long adminUserId, String keyword, Long productId, String status) {
        userAccessService.requireAdmin(adminUserId);
        releaseExpiredCouponLocks();
        List<ProductCouponCodeDto> records = toDtos(productCouponCodeMapper.selectList(buildAdminQuery(keyword, productId, status)
                .orderByDesc("create_time")));
        StringBuilder csv = new StringBuilder("\ufeff");
        csv.append("优惠码,商品,折扣类型,折扣值,状态,有效期,锁定订单,使用订单,使用者,使用时间,批次,备注,创建时间\n");
        for (ProductCouponCodeDto record : records) {
            csv.append(csvCell(record.getCode())).append(',')
                    .append(csvCell(record.getProductTitle())).append(',')
                    .append(csvCell(discountTypeLabel(record.getDiscountType()))).append(',')
                    .append(csvCell(record.getDiscountValue())).append(',')
                    .append(csvCell(statusLabel(record.getStatus()))).append(',')
                    .append(csvCell(record.getExpiresAt())).append(',')
                    .append(csvCell(record.getLockOrderNo())).append(',')
                    .append(csvCell(record.getUsedOrderNo())).append(',')
                    .append(csvCell(record.getUsedByName())).append(',')
                    .append(csvCell(record.getUsedAt())).append(',')
                    .append(csvCell(record.getBatchNo())).append(',')
                    .append(csvCell(record.getNote())).append(',')
                    .append(csvCell(record.getCreateTime())).append('\n');
        }
        return csv.toString();
    }

    @Override
    public ProductCouponPreviewDto previewProductCoupon(Long userId, Long productId, String couponCode) {
        userAccessService.requireActiveUser(userId);
        releaseExpiredCouponLocks();
        Product product = productService.requirePurchasableProduct(productId);
        BigDecimal originalAmount = normalizeMoney(product.getPrice());
        if (originalAmount.compareTo(BigDecimal.ZERO) == 0) {
            throw ApiException.badRequest("免费商品无需使用优惠码");
        }
        ProductCouponCode coupon = requireUsableCoupon(product, couponCode);
        BigDecimal discountAmount = calculateDiscountAmount(coupon, originalAmount);

        ProductCouponPreviewDto dto = new ProductCouponPreviewDto();
        dto.setCode(coupon.getCode());
        dto.setProductId(product.getId());
        dto.setProductTitle(product.getTitle());
        dto.setDiscountType(coupon.getDiscountType());
        dto.setDiscountValue(coupon.getDiscountValue().toPlainString());
        dto.setOriginalAmount(originalAmount.toPlainString());
        dto.setDiscountAmount(discountAmount.toPlainString());
        dto.setPayableAmount(originalAmount.subtract(discountAmount).setScale(2, RoundingMode.HALF_UP).toPlainString());
        dto.setExpiresAt(formatDate(coupon.getExpiresAt()));
        return dto;
    }

    @Override
    public ProductCouponCode requireUsableCoupon(Product product, String couponCode) {
        releaseExpiredCouponLocks();
        if (product == null) {
            throw ApiException.badRequest("优惠码只能用于商品订单");
        }
        String normalizedCode = requireCouponCodeText(couponCode);
        ProductCouponCode coupon = productCouponCodeMapper.selectOne(new QueryWrapper<ProductCouponCode>()
                .eq("code", normalizedCode)
                .last("LIMIT 1"));
        if (coupon == null) {
            throw ApiException.badRequest("优惠码不存在");
        }
        if (!product.getId().equals(coupon.getProductId())) {
            throw ApiException.badRequest("这个优惠码不适用于当前商品");
        }
        if (!STATUS_ACTIVE.equalsIgnoreCase(coupon.getStatus())) {
            throw ApiException.badRequest("优惠码不可用或已被使用");
        }
        if (coupon.getExpiresAt() != null && !coupon.getExpiresAt().after(new Date())) {
            throw ApiException.badRequest("优惠码已过期");
        }
        return coupon;
    }

    @Override
    public BigDecimal calculateDiscountAmount(ProductCouponCode couponCode, BigDecimal originalAmount) {
        BigDecimal normalizedOriginal = normalizeMoney(originalAmount);
        BigDecimal rawDiscount;
        if (TYPE_PERCENT.equalsIgnoreCase(couponCode.getDiscountType())) {
            rawDiscount = normalizedOriginal
                    .multiply(couponCode.getDiscountValue())
                    .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        } else {
            rawDiscount = normalizeMoney(couponCode.getDiscountValue());
        }

        BigDecimal maxDiscount = normalizedOriginal.subtract(MIN_PAYABLE_AMOUNT);
        if (maxDiscount.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        if (rawDiscount.compareTo(maxDiscount) > 0) {
            return maxDiscount.setScale(2, RoundingMode.HALF_UP);
        }
        if (rawDiscount.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return rawDiscount.setScale(2, RoundingMode.HALF_UP);
    }

    @Override
    public void lockCouponForOrder(ProductCouponCode couponCode, Long userId, String outTradeNo) {
        if (couponCode == null) {
            return;
        }
        int updated = productCouponCodeMapper.lockForOrder(couponCode.getId(), userId, outTradeNo);
        if (updated <= 0) {
            throw ApiException.badRequest("优惠码已被使用或锁定，请更换优惠码");
        }
    }

    @Override
    public int markCouponUsedForOrder(PaymentOrder order) {
        if (order == null || order.getCouponCodeId() == null) {
            return 0;
        }
        return productCouponCodeMapper.markUsedForOrder(order.getCouponCodeId(), order.getPayerUserId(), order.getOutTradeNo());
    }

    @Override
    public int releaseCouponForOrder(PaymentOrder order) {
        if (order == null || order.getOutTradeNo() == null) {
            return 0;
        }
        return productCouponCodeMapper.releaseByOrderNo(order.getOutTradeNo());
    }

    private void releaseExpiredCouponLocks() {
        productCouponCodeMapper.releaseExpiredOrderLocks();
    }

    private QueryWrapper<ProductCouponCode> buildAdminQuery(String keyword, Long productId, String status) {
        QueryWrapper<ProductCouponCode> queryWrapper = new QueryWrapper<>();
        String normalizedKeyword = normalizeNullableText(keyword);
        if (normalizedKeyword != null) {
            queryWrapper.and(wrapper -> wrapper.like("code", normalizedKeyword)
                    .or()
                    .like("batch_no", normalizedKeyword)
                    .or()
                    .like("note", normalizedKeyword)
                    .or()
                    .like("used_order_no", normalizedKeyword)
                    .or()
                    .like("lock_order_no", normalizedKeyword));
        }
        if (productId != null && productId > 0) {
            queryWrapper.eq("product_id", productId);
        }

        String normalizedStatus = normalizeNullableText(status);
        if (normalizedStatus != null && !"ALL".equalsIgnoreCase(normalizedStatus)) {
            String upperStatus = normalizedStatus.toUpperCase(Locale.ROOT);
            if (STATUS_EXPIRED.equals(upperStatus)) {
                queryWrapper.eq("status", STATUS_ACTIVE).isNotNull("expires_at").le("expires_at", new Date());
            } else if (STATUS_ACTIVE.equals(upperStatus)) {
                queryWrapper.eq("status", STATUS_ACTIVE)
                        .and(wrapper -> wrapper.isNull("expires_at").or().gt("expires_at", new Date()));
            } else if (Set.of(STATUS_LOCKED, STATUS_USED, STATUS_DISABLED).contains(upperStatus)) {
                queryWrapper.eq("status", upperStatus);
            } else {
                throw ApiException.badRequest("优惠码状态筛选不正确");
            }
        }
        return queryWrapper;
    }

    private List<ProductCouponCodeDto> toDtos(List<ProductCouponCode> couponCodes) {
        if (couponCodes == null || couponCodes.isEmpty()) {
            return List.of();
        }
        List<Long> productIds = couponCodes.stream()
                .map(ProductCouponCode::getProductId)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, Product> products = productIds.isEmpty()
                ? Collections.emptyMap()
                : productMapper.selectBatchIds(productIds).stream().collect(Collectors.toMap(Product::getId, item -> item));

        List<Long> userIds = couponCodes.stream()
                .map(ProductCouponCode::getUsedBy)
                .filter(id -> id != null && id > 0)
                .distinct()
                .collect(Collectors.toList());
        Map<Long, User> users = userIds.isEmpty()
                ? Collections.emptyMap()
                : userMapper.selectBatchIds(userIds).stream().collect(Collectors.toMap(User::getId, item -> item));

        return couponCodes.stream()
                .map(coupon -> {
                    Product product = products.get(coupon.getProductId());
                    User usedBy = users.get(coupon.getUsedBy());
                    return ProductCouponCodeDto.fromEntity(
                            coupon,
                            product == null ? null : product.getTitle(),
                            usedBy == null ? null : usedBy.getNickname()
                    );
                })
                .collect(Collectors.toList());
    }

    private ProductCouponCodeDto toDto(ProductCouponCode couponCode) {
        return toDtos(List.of(couponCode)).get(0);
    }

    private Product requireProduct(Long productId) {
        if (productId == null || productId <= 0) {
            throw ApiException.badRequest("请选择商品");
        }
        Product product = productMapper.selectById(productId);
        if (product == null) {
            throw ApiException.notFound("商品不存在");
        }
        return product;
    }

    private ProductCouponCode requireCouponCode(Long couponCodeId) {
        if (couponCodeId == null || couponCodeId <= 0) {
            throw ApiException.badRequest("优惠码 ID 不正确");
        }
        ProductCouponCode couponCode = productCouponCodeMapper.selectById(couponCodeId);
        if (couponCode == null) {
            throw ApiException.notFound("优惠码不存在");
        }
        return couponCode;
    }

    private int normalizeCount(Integer count) {
        int normalized = count == null ? 0 : count;
        if (normalized <= 0) {
            throw ApiException.badRequest("请输入生成数量");
        }
        if (normalized > MAX_GENERATE_COUNT) {
            throw ApiException.badRequest("单次最多生成 " + MAX_GENERATE_COUNT + " 个优惠码");
        }
        return normalized;
    }

    private String normalizeDiscountType(String discountType) {
        String normalized = requireText(discountType, "请选择折扣类型").toUpperCase(Locale.ROOT);
        if (!TYPE_AMOUNT.equals(normalized) && !TYPE_PERCENT.equals(normalized)) {
            throw ApiException.badRequest("折扣类型仅支持立减金额或折扣比例");
        }
        return normalized;
    }

    private BigDecimal normalizeDiscountValue(String discountType, BigDecimal discountValue) {
        if (discountValue == null) {
            throw ApiException.badRequest("请输入折扣值");
        }
        BigDecimal normalized = discountValue.setScale(2, RoundingMode.HALF_UP);
        if (normalized.compareTo(BigDecimal.ZERO) <= 0) {
            throw ApiException.badRequest("折扣值必须大于 0");
        }
        if (TYPE_PERCENT.equals(discountType) && normalized.compareTo(new BigDecimal("100.00")) > 0) {
            throw ApiException.badRequest("折扣比例不能超过 100%");
        }
        if (TYPE_AMOUNT.equals(discountType) && normalized.compareTo(MAX_DISCOUNT_AMOUNT) > 0) {
            throw ApiException.badRequest("立减金额超出支持范围");
        }
        return normalized;
    }

    private Date resolveExpiresAt(Integer expiresInDays) {
        if (expiresInDays == null) {
            return null;
        }
        if (expiresInDays <= 0 || expiresInDays > 3650) {
            throw ApiException.badRequest("有效期天数需要在 1 到 3650 之间");
        }
        LocalDateTime expires = LocalDateTime.now().plusDays(expiresInDays).withHour(23).withMinute(59).withSecond(59);
        return Date.from(expires.atZone(ZoneId.systemDefault()).toInstant());
    }

    private String normalizePrefix(String prefix) {
        String normalized = normalizeNullableText(prefix);
        if (normalized == null) {
            return "";
        }
        String cleaned = normalized.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
        return limitText(cleaned, 10);
    }

    private String generateUniqueCode(String prefix) {
        for (int attempt = 0; attempt < 20; attempt += 1) {
            String code = (prefix == null || prefix.isBlank() ? "" : prefix + "-") + randomCode(12);
            Long count = productCouponCodeMapper.selectCount(new QueryWrapper<ProductCouponCode>().eq("code", code));
            if (count == null || count == 0) {
                return code;
            }
        }
        throw ApiException.badRequest("优惠码生成冲突，请稍后重试");
    }

    private String randomCode(int length) {
        StringBuilder builder = new StringBuilder(length);
        for (int index = 0; index < length; index += 1) {
            builder.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
        }
        return builder.toString();
    }

    private BigDecimal normalizeMoney(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String requireCouponCodeText(String value) {
        String normalized = normalizeNullableText(value);
        if (normalized == null) {
            throw ApiException.badRequest("请输入优惠码");
        }
        String cleaned = normalized.toUpperCase(Locale.ROOT).replaceAll("\\s+", "");
        if (!cleaned.matches("^[A-Z0-9_-]{4,32}$")) {
            throw ApiException.badRequest("优惠码格式不正确");
        }
        return cleaned;
    }

    private void logOperation(User operator, String actionType, Long targetId, String targetName, String detail) {
        AdminOperationLog log = new AdminOperationLog();
        log.setOperatorId(operator.getId());
        log.setOperatorRole(operator.getRole());
        log.setActionType(actionType);
        log.setTargetType("PRODUCT_COUPON");
        log.setTargetId(targetId);
        log.setTargetName(limitText(normalizeNullableText(targetName), 160));
        log.setDetail(limitText(normalizeNullableText(detail), 500));
        log.setCreateTime(new Date());
        adminOperationLogMapper.insert(log);
    }

    private String discountTypeLabel(String value) {
        if (TYPE_PERCENT.equalsIgnoreCase(value)) {
            return "折扣比例";
        }
        return "立减金额";
    }

    private String statusLabel(String value) {
        if (STATUS_ACTIVE.equalsIgnoreCase(value)) return "可用";
        if (STATUS_LOCKED.equalsIgnoreCase(value)) return "已锁定";
        if (STATUS_USED.equalsIgnoreCase(value)) return "已使用";
        if (STATUS_DISABLED.equalsIgnoreCase(value)) return "已作废";
        if (STATUS_EXPIRED.equalsIgnoreCase(value)) return "已过期";
        return value == null ? "" : value;
    }

    private String csvCell(String value) {
        String normalized = value == null ? "" : value.replace("\"", "\"\"");
        return "\"" + normalized + "\"";
    }

    private String formatDate(Date date) {
        if (date == null) {
            return null;
        }
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(date);
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
