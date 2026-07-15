package com.idncar.service;

import com.idncar.model.dto.AdminProductStatsDto;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.ProductDto;
import com.idncar.model.dto.SaveProductRequest;
import com.idncar.model.entity.Product;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

public interface ProductService {

    List<ProductDto> getPublishedProducts();

    ProductDto getPublishedProduct(Long productId);

    List<ProductDto> getAdminProducts(Long adminUserId);

    PageResultDto<ProductDto> getAdminProductsPage(Long adminUserId, Integer page, Integer size, String keyword, String status);

    AdminProductStatsDto getAdminProductStats(Long adminUserId);

    ProductDto createProduct(Long adminUserId, SaveProductRequest request);

    ProductDto updateProduct(Long adminUserId, Long productId, SaveProductRequest request);

    Map<String, String> uploadProductImage(Long adminUserId, MultipartFile file);

    void deleteProduct(Long adminUserId, Long productId);

    Product requirePurchasableProduct(Long productId);
}
