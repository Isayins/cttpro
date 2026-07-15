package com.idncar.service;

import com.idncar.model.dto.CreateProductCouponCodesRequest;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.ProductCouponCodeDto;
import com.idncar.model.dto.ProductCouponPreviewDto;
import com.idncar.model.dto.ProductCouponStatsDto;
import com.idncar.model.entity.PaymentOrder;
import com.idncar.model.entity.Product;
import com.idncar.model.entity.ProductCouponCode;

import java.math.BigDecimal;
import java.util.List;

public interface ProductCouponCodeService {

    PageResultDto<ProductCouponCodeDto> getAdminCouponCodes(Long adminUserId, Integer page, Integer size, String keyword, Long productId, String status);

    ProductCouponStatsDto getAdminCouponStats(Long adminUserId);

    List<ProductCouponCodeDto> createCouponCodes(Long adminUserId, CreateProductCouponCodesRequest request);

    ProductCouponCodeDto disableCouponCode(Long adminUserId, Long couponCodeId);

    List<ProductCouponCodeDto> disableCouponBatch(Long adminUserId, String batchNo);

    String exportAdminCouponCodesCsv(Long adminUserId, String keyword, Long productId, String status);

    ProductCouponPreviewDto previewProductCoupon(Long userId, Long productId, String couponCode);

    ProductCouponCode requireUsableCoupon(Product product, String couponCode);

    BigDecimal calculateDiscountAmount(ProductCouponCode couponCode, BigDecimal originalAmount);

    void lockCouponForOrder(ProductCouponCode couponCode, Long userId, String outTradeNo);

    int markCouponUsedForOrder(PaymentOrder order);

    int releaseCouponForOrder(PaymentOrder order);
}
