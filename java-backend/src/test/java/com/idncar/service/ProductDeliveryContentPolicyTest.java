package com.idncar.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.idncar.exception.ApiException;
import com.idncar.mapper.AdminOperationLogMapper;
import com.idncar.mapper.ProductDeliveryCodeMapper;
import com.idncar.mapper.ProductMapper;
import com.idncar.mapper.UserMapper;
import com.idncar.model.dto.ProductDto;
import com.idncar.model.dto.SaveProductRequest;
import com.idncar.model.entity.Product;
import com.idncar.model.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProductDeliveryContentPolicyTest {
    private static final String PRIVATE_CONTENT = "private-delivery-fixture-7c4b";
    private final ObjectMapper json = new ObjectMapper();
    private ProductMapper products;
    private ProductDeliveryCodeMapper codes;
    private ProductService service;
    private Product savedProduct;

    @BeforeEach
    void setUp() {
        products = mock(ProductMapper.class);
        when(products.insert(any(Product.class))).thenAnswer(invocation -> {
            savedProduct = invocation.getArgument(0);
            savedProduct.setId(1L);
            return 1;
        });
        when(products.selectById(1L)).thenAnswer(invocation -> savedProduct);
        codes = mock(ProductDeliveryCodeMapper.class);
        when(codes.selectMaps(any())).thenReturn(List.of(Map.of(
                "product_id", 1L, "status", "AVAILABLE", "total", 7L)));
        User admin = new User();
        admin.setId(90L);
        admin.setRole("ADMIN");
        admin.setStatus("ACTIVE");
        UserMapper users = mock(UserMapper.class);
        when(users.selectById(90L)).thenReturn(admin);
        UserAccessService access = new UserAccessService();
        ReflectionTestUtils.setField(access, "userMapper", users);
        service = new ProductService();
        ReflectionTestUtils.setField(service, "productMapper", products);
        ReflectionTestUtils.setField(service, "productDeliveryCodeMapper", codes);
        ReflectionTestUtils.setField(service, "userAccessService", access);
        ReflectionTestUtils.setField(service, "adminOperationLogMapper", mock(AdminOperationLogMapper.class));
    }

    @ParameterizedTest
    @CsvSource({"NONE, 3", "CDK_EMAIL, 7"})
    void publicCatalogAndDetailHideContentWhileAdminRetainsIt(String deliveryType, int visibleStock) throws Exception {
        Product product = product(deliveryType, PRIVATE_CONTENT);
        when(products.selectList(any())).thenReturn(List.of(product));
        when(products.selectById(1L)).thenReturn(product);

        List<ProductDto> catalog = service.getPublishedProducts();
        ProductDto detail = service.getPublishedProduct(1L);
        String catalogJson = json.writeValueAsString(catalog);
        String detailJson = json.writeValueAsString(detail);
        assertThat(catalogJson).doesNotContain(PRIVATE_CONTENT);
        assertThat(detailJson).doesNotContain(PRIVATE_CONTENT);
        assertThat(json.readTree(catalogJson).get(0).path("deliveryInstructions").isNull()).isTrue();
        assertThat(json.readTree(detailJson).path("deliveryInstructions").isNull()).isTrue();
        assertThat(catalog).singleElement().satisfies(dto -> assertThat(dto.getStock()).isEqualTo(visibleStock));
        assertThat(detail.getStock()).isEqualTo(visibleStock);

        ProductDto adminProduct = service.getAdminProducts(90L).get(0);
        assertThat(adminProduct.getDeliveryInstructions()).isEqualTo(PRIVATE_CONTENT);
        assertThat(json.readTree(json.writeValueAsString(adminProduct)).path("deliveryInstructions").asText())
                .isEqualTo(PRIVATE_CONTENT);
        assertThat(product.getDeliveryInstructions()).isEqualTo(PRIVATE_CONTENT);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = " \t\n ")
    void publishingOrdinaryProductRequiresExplicitDeliveryContent(String instructions) {
        SaveProductRequest request = request("NONE", "PUBLISHED", instructions);
        assertThatThrownBy(() -> service.createProduct(90L, request))
                .isInstanceOf(ApiException.class)
                .hasMessage("商品尚未配置交付内容，请联系管理员处理");
        verify(products, never()).insert(any(Product.class));
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = " \t\n ")
    void stockedOrdinaryProductCannotBePurchasedWithoutExplicitDeliveryContent(String instructions) {
        Product product = product("NONE", instructions);
        product.setDescription("Public description is not delivery content");
        product.setSubtitle("Public subtitle is not delivery content");
        when(products.selectById(1L)).thenReturn(product);

        assertThatThrownBy(() -> service.requirePurchasableProduct(1L))
                .isInstanceOf(ApiException.class)
                .hasMessage("商品尚未配置交付内容，请联系管理员处理");
    }

    @ParameterizedTest
    @ValueSource(strings = {"DRAFT", "OFFLINE"})
    void ordinaryProductCanBeSavedWithoutContentWhileUnpublished(String status) {
        ProductDto saved = service.createProduct(90L, request("NONE", status, null));

        assertThat(saved.getStatus()).isEqualTo(status);
        assertThat(saved.getDeliveryInstructions()).isNull();
        assertThat(saved.getStock()).isEqualTo(3);
    }

    @Test
    void publishedCdkProductNeedsNoInstructionsAndUsesAvailableCodesForStock() {
        when(codes.selectCount(any())).thenReturn(7L);

        ProductDto saved = service.createProduct(90L, request("CDK_EMAIL", "PUBLISHED", null));

        assertThat(saved.getDeliveryInstructions()).isNull();
        assertThat(saved.getStock()).isEqualTo(7);
        assertThat(savedProduct.getStock()).isZero();
        assertThat(service.requirePurchasableProduct(1L)).isSameAs(savedProduct);
    }

    @ParameterizedTest
    @ValueSource(strings = {"0.00", "9.90"})
    void configuredOrdinaryProductCanBeCreatedUpdatedAndPurchased(String price) {
        SaveProductRequest request = request("NONE", "PUBLISHED", PRIVATE_CONTENT);
        request.setPrice(new BigDecimal(price));

        ProductDto created = service.createProduct(90L, request);
        assertThat(created.getDeliveryInstructions()).isEqualTo(PRIVATE_CONTENT);
        assertThat(created.getPrice()).isEqualTo(price);

        request.setDeliveryInstructions(PRIVATE_CONTENT + "-updated");
        ProductDto updated = service.updateProduct(90L, 1L, request);
        assertThat(updated.getDeliveryInstructions()).isEqualTo(PRIVATE_CONTENT + "-updated");
        assertThat(service.requirePurchasableProduct(1L)).isSameAs(savedProduct);
    }

    @ParameterizedTest
    @ValueSource(strings = {"DRAFT", "OFFLINE", "PUBLISHED"})
    void updatingAnOrdinaryProductToPublishedRequiresContent(String originalStatus) {
        Product product = product("NONE", PRIVATE_CONTENT);
        product.setStatus(originalStatus);
        when(products.selectById(1L)).thenReturn(product);

        assertThatThrownBy(() -> service.updateProduct(90L, 1L, request("NONE", "PUBLISHED", null)))
                .isInstanceOf(ApiException.class)
                .hasMessage("商品尚未配置交付内容，请联系管理员处理");
        verify(products, never()).updateById(any(Product.class));
    }

    @Test
    void legacyProductWithoutDeliveryTypeStillRequiresContentToPurchase() {
        when(products.selectById(1L)).thenReturn(product(null, null));

        assertThatThrownBy(() -> service.requirePurchasableProduct(1L))
                .isInstanceOf(ApiException.class)
                .hasMessage("商品尚未配置交付内容，请联系管理员处理");
    }

    @Test
    void purchasePriceErrorTakesPrecedenceOverStockAndContentErrors() {
        Product product = product("NONE", null);
        product.setPrice(null);
        product.setStock(0);
        when(products.selectById(1L)).thenReturn(product);

        assertThatThrownBy(() -> service.requirePurchasableProduct(1L))
                .isInstanceOf(ApiException.class)
                .hasMessage("商品价格配置不正确");
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(ints = 0)
    void purchaseStockErrorTakesPrecedenceOverContentError(Integer stock) {
        Product product = product("NONE", null);
        product.setStock(stock);
        when(products.selectById(1L)).thenReturn(product);

        assertThatThrownBy(() -> service.requirePurchasableProduct(1L))
                .isInstanceOf(ApiException.class)
                .hasMessage("商品库存不足");
    }

    @Test
    void savingPriceErrorTakesPrecedenceOverStockAndContentErrors() {
        SaveProductRequest request = request("NONE", "PUBLISHED", null);
        request.setPrice(null);
        request.setStock(null);

        assertThatThrownBy(() -> service.createProduct(90L, request))
                .isInstanceOf(ApiException.class)
                .hasMessage("请输入商品价格");
    }

    @Test
    void savingStockErrorTakesPrecedenceOverContentError() {
        SaveProductRequest request = request("NONE", "PUBLISHED", null);
        request.setStock(null);

        assertThatThrownBy(() -> service.createProduct(90L, request))
                .isInstanceOf(ApiException.class)
                .hasMessage("请输入商品库存");
    }

    @Test
    void cdkProductWithoutAvailableCodesKeepsItsInventoryError() {
        when(codes.selectCount(any())).thenReturn(0L);
        when(products.selectById(1L)).thenReturn(product("CDK_EMAIL", null));

        assertThatThrownBy(() -> service.requirePurchasableProduct(1L))
                .isInstanceOf(ApiException.class)
                .hasMessage("该虚拟商品CDK库存不足，请联系管理员补货");
    }

    private SaveProductRequest request(String deliveryType, String status, String instructions) {
        SaveProductRequest request = new SaveProductRequest();
        request.setTitle("Delivery fixture");
        request.setDescription("Public description is not delivery content");
        request.setSubtitle("Public subtitle is not delivery content");
        request.setPrice(new BigDecimal("9.90"));
        request.setStock(3);
        request.setDeliveryType(deliveryType);
        request.setStatus(status);
        request.setDeliveryInstructions(instructions);
        return request;
    }

    private Product product(String deliveryType, String instructions) {
        Product product = new Product();
        product.setId(1L);
        product.setTitle("Delivery fixture");
        product.setPrice(new BigDecimal("9.90"));
        product.setStock(3);
        product.setStatus("PUBLISHED");
        product.setDeliveryType(deliveryType);
        product.setDeliveryInstructions(instructions);
        return product;
    }
}
