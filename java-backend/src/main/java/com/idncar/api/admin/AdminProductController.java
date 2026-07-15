package com.idncar.api.admin;

import com.idncar.model.dto.AdminProductStatsDto;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.ProductDto;
import com.idncar.model.dto.SaveProductRequest;
import com.idncar.service.ProductService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/products")
public class AdminProductController {

    @Autowired
    private ProductService productService;

    @GetMapping
    public ResponseEntity<List<ProductDto>> getProducts(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(productService.getAdminProducts(userId));
    }

    @GetMapping("/page")
    public ResponseEntity<PageResultDto<ProductDto>> getProductsPage(
            @RequestAttribute("userId") Long userId,
            @RequestParam(defaultValue = "1") Integer page,
            @RequestParam(defaultValue = "10") Integer size,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String status) {
        return ResponseEntity.ok(productService.getAdminProductsPage(userId, page, size, keyword, status));
    }

    @GetMapping("/stats")
    public ResponseEntity<AdminProductStatsDto> getProductStats(@RequestAttribute("userId") Long userId) {
        return ResponseEntity.ok(productService.getAdminProductStats(userId));
    }

    @PostMapping
    public ResponseEntity<ProductDto> createProduct(@RequestAttribute("userId") Long userId,
                                                    @RequestBody SaveProductRequest request) {
        return ResponseEntity.ok(productService.createProduct(userId, request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductDto> updateProduct(@RequestAttribute("userId") Long userId,
                                                    @PathVariable Long id,
                                                    @RequestBody SaveProductRequest request) {
        return ResponseEntity.ok(productService.updateProduct(userId, id, request));
    }

    @PostMapping(value = "/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> uploadProductImage(@RequestAttribute("userId") Long userId,
                                                                  @RequestParam("file") MultipartFile file) {
        return ResponseEntity.ok(productService.uploadProductImage(userId, file));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteProduct(@RequestAttribute("userId") Long userId,
                                              @PathVariable Long id) {
        productService.deleteProduct(userId, id);
        return ResponseEntity.noContent().build();
    }
}
