package com.idncar.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.idncar.exception.ApiException;
import com.idncar.mapper.AdminOperationLogMapper;
import com.idncar.mapper.ProductDeliveryCodeMapper;
import com.idncar.mapper.ProductMapper;
import com.idncar.model.dto.AdminProductStatsDto;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.ProductDto;
import com.idncar.model.dto.SaveProductRequest;
import com.idncar.model.entity.AdminOperationLog;
import com.idncar.model.entity.Product;
import com.idncar.model.entity.ProductDeliveryCode;
import com.idncar.model.entity.User;
import com.idncar.service.ProductService;
import com.idncar.service.UserAccessService;
import com.idncar.util.ImageUploadHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Date;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.HashMap;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class ProductServiceImpl implements ProductService {

    private static final BigDecimal MAX_PRICE = new BigDecimal("99999999.99");
    private static final String DELIVERY_TYPE_CDK_EMAIL = "CDK_EMAIL";
    private static final String DELIVERY_CODE_STATUS_AVAILABLE = "AVAILABLE";
    private static final List<String> PRODUCT_STATUSES = List.of("PUBLISHED", "DRAFT", "OFFLINE");
    private static final List<String> DELIVERY_TYPES = List.of("NONE", DELIVERY_TYPE_CDK_EMAIL);

    @Value("${app.upload.base-dir:uploads}")
    private String uploadBaseDir;

    @Value("${app.upload.product-image-subdir:product-images}")
    private String productImageSubDir;

    @Autowired
    private ProductMapper productMapper;

    @Autowired
    private ProductDeliveryCodeMapper productDeliveryCodeMapper;

    @Autowired
    private UserAccessService userAccessService;

    @Autowired
    private AdminOperationLogMapper adminOperationLogMapper;

    @Override
    public List<ProductDto> getPublishedProducts() {
        return productMapper.selectList(new QueryWrapper<Product>()
                        .eq("status", "PUBLISHED")
                        .orderByAsc("sort_order")
                        .orderByDesc("update_time"))
                .stream()
                .collect(Collectors.collectingAndThen(Collectors.toList(), this::toAdminProductDtos));
    }

    @Override
    public ProductDto getPublishedProduct(Long productId) {
        Product product = productMapper.selectById(productId);
        if (product == null || !"PUBLISHED".equalsIgnoreCase(product.getStatus())) {
            throw ApiException.notFound("商品不存在或已下架");
        }
        return toAdminProductDto(product);
    }

    @Override
    public List<ProductDto> getAdminProducts(Long adminUserId) {
        userAccessService.requireAdmin(adminUserId);
        return productMapper.selectList(new QueryWrapper<Product>()
                        .orderByAsc("sort_order")
                        .orderByDesc("update_time"))
                .stream()
                .collect(Collectors.collectingAndThen(Collectors.toList(), this::toAdminProductDtos));
    }

    @Override
    public PageResultDto<ProductDto> getAdminProductsPage(Long adminUserId, Integer page, Integer size, String keyword, String status) {
        userAccessService.requireAdmin(adminUserId);
        int safePage = page == null ? 1 : Math.max(1, page);
        int safeSize = size == null ? 10 : Math.max(1, Math.min(size, 100));

        QueryWrapper<Product> queryWrapper = new QueryWrapper<>();
        applyAdminProductFilters(queryWrapper, keyword, status);
        queryWrapper.orderByAsc("sort_order").orderByDesc("update_time");

        Page<Product> result = productMapper.selectPage(new Page<>(safePage, safeSize), queryWrapper);
        List<ProductDto> records = toAdminProductDtos(result.getRecords());
        return PageResultDto.of(records, result.getTotal(), safePage, safeSize);
    }

    @Override
    public AdminProductStatsDto getAdminProductStats(Long adminUserId) {
        userAccessService.requireAdmin(adminUserId);
        Long total = productMapper.selectCount(new QueryWrapper<Product>());
        Long published = productMapper.selectCount(new QueryWrapper<Product>().eq("status", "PUBLISHED"));
        Long draft = productMapper.selectCount(new QueryWrapper<Product>()
                .and(wrapper -> wrapper.eq("status", "DRAFT").or().isNull("status").or().eq("status", "")));
        Long offline = productMapper.selectCount(new QueryWrapper<Product>().eq("status", "OFFLINE"));
        return AdminProductStatsDto.of(total, published, draft, offline);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ProductDto createProduct(Long adminUserId, SaveProductRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);
        Product product = new Product();
        fillProduct(product, request);
        product.setSalesCount(0);
        productMapper.insert(product);
        Product saved = productMapper.selectById(product.getId());
        logOperation(operator, "PRODUCT_CREATED", saved.getId(), saved.getTitle(), "新增商品");
        return toAdminProductDto(saved);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public ProductDto updateProduct(Long adminUserId, Long productId, SaveProductRequest request) {
        User operator = userAccessService.requireAdmin(adminUserId);
        Product product = requireProduct(productId);
        String oldTitle = product.getTitle();
        fillProduct(product, request);
        product.setUpdateTime(new Date());
        productMapper.updateById(product);
        Product saved = productMapper.selectById(productId);
        logOperation(operator, "PRODUCT_UPDATED", saved.getId(), saved.getTitle(), "更新商品 " + oldTitle + " -> " + saved.getTitle());
        return toAdminProductDto(saved);
    }

    @Override
    public Map<String, String> uploadProductImage(Long adminUserId, MultipartFile file) {
        User operator = userAccessService.requireAdmin(adminUserId);
        Map<String, String> uploaded = ImageUploadHelper.saveImage(file, operator.getId(), uploadBaseDir, productImageSubDir, "product", "商品");
        logOperation(operator, "PRODUCT_IMAGE_UPLOADED", null, uploaded.get("originalFileName"), "上传商品图片");
        return uploaded;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteProduct(Long adminUserId, Long productId) {
        User operator = userAccessService.requireAdmin(adminUserId);
        Product product = requireProduct(productId);
        productMapper.deleteById(productId);
        logOperation(operator, "PRODUCT_DELETED", product.getId(), product.getTitle(), "删除商品");
    }

    @Override
    public Product requirePurchasableProduct(Long productId) {
        Product product = requireProduct(productId);
        if (!"PUBLISHED".equalsIgnoreCase(product.getStatus())) {
            throw ApiException.badRequest("商品未上架，暂不可购买");
        }
        if (product.getPrice() == null || product.getPrice().compareTo(BigDecimal.ZERO) < 0) {
            throw ApiException.badRequest("商品价格配置不正确");
        }
        if (isCdkEmailProduct(product)) {
            if (countAvailableDeliveryCodes(product.getId()) <= 0) {
                throw ApiException.badRequest("该虚拟商品CDK库存不足，请联系管理员补货");
            }
            return product;
        }
        if (product.getStock() == null || product.getStock() <= 0) {
            throw ApiException.badRequest("商品库存不足");
        }
        return product;
    }

    private Product requireProduct(Long productId) {
        if (productId == null || productId <= 0) {
            throw ApiException.badRequest("商品 ID 不正确");
        }
        Product product = productMapper.selectById(productId);
        if (product == null) {
            throw ApiException.notFound("商品不存在");
        }
        return product;
    }

    private ProductDto toAdminProductDto(Product product) {
        List<ProductDto> records = toAdminProductDtos(product == null ? Collections.emptyList() : List.of(product));
        return records.isEmpty() ? null : records.get(0);
    }

    private List<ProductDto> toAdminProductDtos(List<Product> products) {
        if (products == null || products.isEmpty()) {
            return Collections.emptyList();
        }
        List<ProductDto> records = products.stream()
                .map(ProductDto::fromEntity)
                .collect(Collectors.toList());
        enrichDeliveryCodeCounts(records);
        return records;
    }

    private void enrichDeliveryCodeCounts(List<ProductDto> records) {
        List<Long> productIds = records.stream()
                .map(ProductDto::getId)
                .filter(id -> id != null && id > 0)
                .collect(Collectors.toList());
        if (productIds.isEmpty()) {
            return;
        }

        Map<Long, ProductDto> productMap = new HashMap<>();
        for (ProductDto record : records) {
            if (record.getId() != null) {
                productMap.put(record.getId(), record);
            }
        }
        for (ProductDto record : records) {
            record.setDeliveryCodeAvailableCount(0);
            record.setDeliveryCodeLockedCount(0);
            record.setDeliveryCodeSentCount(0);
            record.setDeliveryCodeDisabledCount(0);
        }

        List<Map<String, Object>> rows = productDeliveryCodeMapper.selectMaps(new QueryWrapper<ProductDeliveryCode>()
                .select("product_id", "status", "COUNT(*) AS total")
                .in("product_id", productIds)
                .groupBy("product_id", "status"));
        for (Map<String, Object> row : rows) {
            Long productId = toLongValue(firstMapValue(row, "product_id", "PRODUCT_ID"));
            String status = String.valueOf(firstMapValue(row, "status", "STATUS"));
            Integer total = toIntegerValue(firstMapValue(row, "total", "TOTAL"));
            ProductDto record = productId == null ? null : productMap.get(productId);
            if (record == null || total == null) {
                continue;
            }
            if ("AVAILABLE".equalsIgnoreCase(status)) {
                record.setDeliveryCodeAvailableCount(total);
            } else if ("LOCKED".equalsIgnoreCase(status)) {
                record.setDeliveryCodeLockedCount(total);
            } else if ("SENT".equalsIgnoreCase(status)) {
                record.setDeliveryCodeSentCount(total);
            } else if ("DISABLED".equalsIgnoreCase(status)) {
                record.setDeliveryCodeDisabledCount(total);
            }
        }
        for (ProductDto record : records) {
            if (DELIVERY_TYPE_CDK_EMAIL.equalsIgnoreCase(record.getDeliveryType())) {
                record.setStock(record.getDeliveryCodeAvailableCount() == null ? 0 : record.getDeliveryCodeAvailableCount());
            }
        }
    }

    private Object firstMapValue(Map<String, Object> row, String... keys) {
        if (row == null || keys == null) {
            return null;
        }
        for (String key : keys) {
            if (row.containsKey(key)) {
                return row.get(key);
            }
        }
        return null;
    }

    private Long toLongValue(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private Integer toIntegerValue(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private boolean isCdkEmailProduct(Product product) {
        return product != null && DELIVERY_TYPE_CDK_EMAIL.equalsIgnoreCase(product.getDeliveryType());
    }

    private long countAvailableDeliveryCodes(Long productId) {
        if (productId == null) {
            return 0;
        }
        Long count = productDeliveryCodeMapper.selectCount(new QueryWrapper<ProductDeliveryCode>()
                .eq("product_id", productId)
                .eq("status", DELIVERY_CODE_STATUS_AVAILABLE));
        return count == null ? 0 : count;
    }

    private void fillProduct(Product product, SaveProductRequest request) {
        if (request == null) {
            throw ApiException.badRequest("缺少商品数据");
        }
        product.setTitle(limitText(requireText(request.getTitle(), "请输入商品名称"), 120));
        product.setSubtitle(limitText(normalizeNullableText(request.getSubtitle()), 180));
        product.setDescription(limitText(normalizeNullableText(request.getDescription()), 2000));
        product.setImageUrl(limitText(normalizeNullableText(request.getImageUrl()), 500));
        product.setPrice(normalizePrice(request.getPrice()));
        String deliveryType = normalizeDeliveryType(request.getDeliveryType());
        product.setStock(DELIVERY_TYPE_CDK_EMAIL.equals(deliveryType) ? 0 : normalizeStock(request.getStock()));
        product.setDeliveryType(deliveryType);
        product.setDeliveryInstructions(limitText(normalizeNullableText(request.getDeliveryInstructions()), 5000));
        product.setStatus(normalizeStatus(request.getStatus()));
        product.setSortOrder(request.getSortOrder() == null ? 0 : Math.max(0, request.getSortOrder()));
    }

    private BigDecimal normalizePrice(BigDecimal price) {
        if (price == null) {
            throw ApiException.badRequest("请输入商品价格");
        }
        try {
            BigDecimal normalized = price.setScale(2, RoundingMode.UNNECESSARY);
            if (normalized.compareTo(BigDecimal.ZERO) < 0) {
                throw ApiException.badRequest("商品价格不能为负数");
            }
            if (normalized.compareTo(MAX_PRICE) > 0) {
                throw ApiException.badRequest("商品价格超出支持范围");
            }
            return normalized;
        } catch (ArithmeticException exception) {
            throw ApiException.badRequest("商品价格最多支持两位小数");
        }
    }

    private Integer normalizeStock(Integer stock) {
        if (stock == null) {
            throw ApiException.badRequest("请输入商品库存");
        }
        if (stock < 0) {
            throw ApiException.badRequest("商品库存不能为负数");
        }
        return stock;
    }

    private String normalizeDeliveryType(String deliveryType) {
        String normalized = normalizeNullableText(deliveryType);
        if (normalized == null) {
            return "NONE";
        }
        String upper = normalized.toUpperCase(Locale.ROOT);
        if (!DELIVERY_TYPES.contains(upper)) {
            throw ApiException.badRequest("发货方式仅支持 NONE 或 CDK_EMAIL");
        }
        return upper;
    }

    private String normalizeStatus(String status) {
        String normalized = normalizeNullableText(status);
        if (normalized == null) {
            return "DRAFT";
        }
        String upper = normalized.toUpperCase(Locale.ROOT);
        if (!PRODUCT_STATUSES.contains(upper)) {
            throw ApiException.badRequest("商品状态仅支持 PUBLISHED、DRAFT 或 OFFLINE");
        }
        return upper;
    }

    private void applyAdminProductFilters(QueryWrapper<Product> queryWrapper, String keyword, String status) {
        String normalizedKeyword = normalizeNullableText(keyword);
        if (normalizedKeyword != null) {
            queryWrapper.and(wrapper -> wrapper.like("title", normalizedKeyword)
                    .or()
                    .like("subtitle", normalizedKeyword)
                    .or()
                    .like("description", normalizedKeyword)
                    .or()
                    .like("price", normalizedKeyword)
                    .or()
                    .like("stock", normalizedKeyword)
                    .or()
                    .like("delivery_type", normalizedKeyword)
                    .or()
                    .like("status", normalizedKeyword));
        }

        String normalizedStatus = normalizeNullableText(status);
        if (normalizedStatus == null || "ALL".equalsIgnoreCase(normalizedStatus)) {
            return;
        }

        String upperStatus = normalizedStatus.toUpperCase(Locale.ROOT);
        if (!PRODUCT_STATUSES.contains(upperStatus)) {
            throw ApiException.badRequest("商品状态筛选仅支持 PUBLISHED、DRAFT 或 OFFLINE");
        }
        if ("DRAFT".equals(upperStatus)) {
            queryWrapper.and(wrapper -> wrapper.eq("status", "DRAFT").or().isNull("status").or().eq("status", ""));
            return;
        }
        queryWrapper.eq("status", upperStatus);
    }

    private void logOperation(User operator, String actionType, Long targetId, String targetName, String detail) {
        AdminOperationLog log = new AdminOperationLog();
        log.setOperatorId(operator.getId());
        log.setOperatorRole(operator.getRole());
        log.setActionType(actionType);
        log.setTargetType("PRODUCT");
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

    private String limitText(String value, int maxLength) {
        if (value == null || value.length() <= maxLength) {
            return value;
        }
        return value.substring(0, maxLength);
    }
}
