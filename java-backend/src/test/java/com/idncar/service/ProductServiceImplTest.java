package com.idncar.service;

import com.idncar.exception.ApiException;
import com.idncar.mapper.ProductDeliveryCodeMapper;
import com.idncar.mapper.ProductMapper;
import com.idncar.model.dto.ProductDto;
import com.idncar.model.dto.SaveProductRequest;
import com.idncar.model.entity.Product;
import com.idncar.model.entity.User;
import com.idncar.service.impl.ProductServiceImpl;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ProductServiceImplTest {

    @Test
    void createProductRequiresStock() throws Exception {
        SaveProductRequest request = new SaveProductRequest();
        request.setTitle("会员兑换卡");
        request.setPrice(BigDecimal.ONE);
        request.setStock(null);
        request.setStatus("DRAFT");

        User operator = new User();
        operator.setId(1L);
        operator.setRole("ADMIN");

        UserAccessService userAccessService = mock(UserAccessService.class);
        when(userAccessService.requireAdmin(1L)).thenReturn(operator);

        ProductServiceImpl service = new ProductServiceImpl();
        setField(service, "userAccessService", userAccessService);

        assertThatThrownBy(() -> service.createProduct(1L, request))
                .isInstanceOf(ApiException.class)
                .hasMessage("请输入商品库存");
    }

    @Test
    void purchasableProductRejectsMissingStock() throws Exception {
        Product product = new Product();
        product.setId(1L);
        product.setTitle("会员兑换卡");
        product.setPrice(BigDecimal.ONE);
        product.setStatus("PUBLISHED");
        product.setDeliveryType("NONE");
        product.setStock(null);

        ProductMapper productMapper = mock(ProductMapper.class);
        when(productMapper.selectById(1L)).thenReturn(product);

        ProductServiceImpl service = new ProductServiceImpl();
        setField(service, "productMapper", productMapper);

        assertThatThrownBy(() -> service.requirePurchasableProduct(1L))
                .isInstanceOf(ApiException.class)
                .hasMessage("商品库存不足");
    }

    @Test
    void cdkProductUsesAvailableDeliveryCodesAsPurchasableStock() throws Exception {
        Product product = new Product();
        product.setId(1L);
        product.setTitle("会员兑换卡");
        product.setPrice(BigDecimal.ONE);
        product.setStatus("PUBLISHED");
        product.setDeliveryType("CDK_EMAIL");
        product.setStock(0);

        ProductMapper productMapper = mock(ProductMapper.class);
        when(productMapper.selectById(1L)).thenReturn(product);
        ProductDeliveryCodeMapper productDeliveryCodeMapper = mock(ProductDeliveryCodeMapper.class);
        when(productDeliveryCodeMapper.selectCount(any())).thenReturn(7L);

        ProductServiceImpl service = new ProductServiceImpl();
        setField(service, "productMapper", productMapper);
        setField(service, "productDeliveryCodeMapper", productDeliveryCodeMapper);

        assertThat(service.requirePurchasableProduct(1L)).isSameAs(product);
    }

    @Test
    void cdkProductSaveForcesProductStockToZero() throws Exception {
        SaveProductRequest request = new SaveProductRequest();
        request.setTitle("会员兑换卡");
        request.setPrice(BigDecimal.ONE);
        request.setStock(100);
        request.setDeliveryType("CDK_EMAIL");
        request.setStatus("DRAFT");

        Product product = new Product();
        ProductServiceImpl service = new ProductServiceImpl();
        invokeFillProduct(service, product, request);

        assertThat(product.getDeliveryType()).isEqualTo("CDK_EMAIL");
        assertThat(product.getStock()).isZero();
    }

    @Test
    void cdkProductDtoUsesAvailableDeliveryCodesAsVisibleStock() throws Exception {
        Product product = new Product();
        product.setId(1L);
        product.setTitle("会员兑换卡");
        product.setPrice(BigDecimal.ONE);
        product.setStatus("PUBLISHED");
        product.setDeliveryType("CDK_EMAIL");
        product.setStock(0);

        ProductDeliveryCodeMapper productDeliveryCodeMapper = mock(ProductDeliveryCodeMapper.class);
        when(productDeliveryCodeMapper.selectMaps(any())).thenReturn(List.of(Map.of(
                "product_id", 1L,
                "status", "AVAILABLE",
                "total", 7L
        )));

        ProductServiceImpl service = new ProductServiceImpl();
        setField(service, "productDeliveryCodeMapper", productDeliveryCodeMapper);

        ProductDto dto = invokeToAdminProductDto(service, product);

        assertThat(dto.getStock()).isEqualTo(7);
        assertThat(dto.getDeliveryCodeAvailableCount()).isEqualTo(7);
    }

    private void setField(Object target, String fieldName, Object value) throws Exception {
        Field field = target.getClass().getDeclaredField(fieldName);
        field.setAccessible(true);
        field.set(target, value);
    }

    private void invokeFillProduct(ProductServiceImpl service, Product product, SaveProductRequest request) throws Exception {
        Method method = ProductServiceImpl.class.getDeclaredMethod("fillProduct", Product.class, SaveProductRequest.class);
        method.setAccessible(true);
        method.invoke(service, product, request);
    }

    private ProductDto invokeToAdminProductDto(ProductServiceImpl service, Product product) throws Exception {
        Method method = ProductServiceImpl.class.getDeclaredMethod("toAdminProductDto", Product.class);
        method.setAccessible(true);
        return (ProductDto) method.invoke(service, product);
    }
}
