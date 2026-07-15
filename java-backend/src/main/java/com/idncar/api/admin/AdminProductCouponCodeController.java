package com.idncar.api.admin;

import com.idncar.model.dto.CreateProductCouponCodesRequest;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.ProductCouponCodeDto;
import com.idncar.model.dto.ProductCouponStatsDto;
import com.idncar.service.ProductCouponCodeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/api/admin/product-coupon-codes")
public class AdminProductCouponCodeController {

    private static final DateTimeFormatter EXPORT_FILE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    @Autowired
    private ProductCouponCodeService productCouponCodeService;

    @GetMapping
    public ResponseEntity<PageResultDto<ProductCouponCodeDto>> getCouponCodes(
            @RequestAttribute("userId") Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(productCouponCodeService.getAdminCouponCodes(userId, page, size, keyword, productId, status));
    }

    @GetMapping("/stats")
    public ResponseEntity<ProductCouponStatsDto> getCouponStats(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(productCouponCodeService.getAdminCouponStats(userId));
    }

    @PostMapping
    public ResponseEntity<List<ProductCouponCodeDto>> createCouponCodes(@RequestAttribute("userId") Long userId,
                                                                        @RequestBody CreateProductCouponCodesRequest request) {
        return ResponseEntity.ok(productCouponCodeService.createCouponCodes(userId, request));
    }

    @PatchMapping("/{id}/disable")
    public ResponseEntity<ProductCouponCodeDto> disableCouponCode(@RequestAttribute("userId") Long userId,
                                                                  @PathVariable Long id) {
        return ResponseEntity.ok(productCouponCodeService.disableCouponCode(userId, id));
    }

    @PatchMapping("/batches/{batchNo}/disable")
    public ResponseEntity<List<ProductCouponCodeDto>> disableCouponBatch(@RequestAttribute("userId") Long userId,
                                                                         @PathVariable String batchNo) {
        return ResponseEntity.ok(productCouponCodeService.disableCouponBatch(userId, batchNo));
    }

    @GetMapping(value = "/export", produces = "text/csv;charset=UTF-8")
    public ResponseEntity<byte[]> exportCouponCodes(
            @RequestAttribute("userId") Long userId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) String status) {
        String csv = productCouponCodeService.exportAdminCouponCodesCsv(userId, keyword, productId, status);
        String filename = "product-coupon-codes-" + LocalDateTime.now().format(EXPORT_FILE_FORMATTER) + ".csv";
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(filename, StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }
}
