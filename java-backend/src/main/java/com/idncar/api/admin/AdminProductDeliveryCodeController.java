package com.idncar.api.admin;

import com.idncar.model.dto.ImportProductDeliveryCodesRequest;
import com.idncar.model.dto.ImportProductDeliveryCodesResponse;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.ProductDeliveryCodeDto;
import com.idncar.model.dto.ProductDeliveryCodeStatsDto;
import com.idncar.service.ProductDeliveryCodeService;
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
@RequestMapping("/api/admin/product-delivery-codes")
public class AdminProductDeliveryCodeController {

    private static final DateTimeFormatter EXPORT_FILE_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    @Autowired
    private ProductDeliveryCodeService productDeliveryCodeService;

    @GetMapping
    public ResponseEntity<PageResultDto<ProductDeliveryCodeDto>> getDeliveryCodes(
            @RequestAttribute("userId") Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(productDeliveryCodeService.getAdminDeliveryCodes(userId, page, size, keyword, productId, status));
    }

    @GetMapping("/stats")
    public ResponseEntity<ProductDeliveryCodeStatsDto> getDeliveryCodeStats(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(productDeliveryCodeService.getAdminDeliveryCodeStats(userId));
    }

    @GetMapping(value = "/export", produces = "text/csv;charset=UTF-8")
    public ResponseEntity<byte[]> exportDeliveryCodes(
            @RequestAttribute("userId") Long userId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) String status) {
        String csv = productDeliveryCodeService.exportAdminDeliveryCodesCsv(userId, keyword, productId, status);
        String filename = "product-delivery-codes-" + LocalDateTime.now().format(EXPORT_FILE_FORMATTER) + ".csv";
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(filename, StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping("/import")
    public ResponseEntity<ImportProductDeliveryCodesResponse> importDeliveryCodes(
            @RequestAttribute("userId") Long userId,
            @RequestBody ImportProductDeliveryCodesRequest request) {
        return ResponseEntity.ok(productDeliveryCodeService.importDeliveryCodes(userId, request));
    }

    @PatchMapping("/{id}/disable")
    public ResponseEntity<ProductDeliveryCodeDto> disableDeliveryCode(@RequestAttribute("userId") Long userId,
                                                                      @PathVariable Long id) {
        return ResponseEntity.ok(productDeliveryCodeService.disableDeliveryCode(userId, id));
    }

    @PatchMapping("/{id}/resend")
    public ResponseEntity<ProductDeliveryCodeDto> resendDeliveryCode(@RequestAttribute("userId") Long userId,
                                                                     @PathVariable Long id) {
        return ResponseEntity.ok(productDeliveryCodeService.resendDeliveryCode(userId, id));
    }

    @PatchMapping("/batches/{batchNo}/disable")
    public ResponseEntity<List<ProductDeliveryCodeDto>> disableDeliveryCodeBatch(@RequestAttribute("userId") Long userId,
                                                                                 @PathVariable String batchNo) {
        return ResponseEntity.ok(productDeliveryCodeService.disableDeliveryCodeBatch(userId, batchNo));
    }
}
