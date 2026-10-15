package com.idncar.service;

import com.idncar.model.entity.Product;

final class ProductDeliveryContentPolicy {
    static final String MISSING_DELIVERY_CONTENT = "商品尚未配置交付内容，请联系管理员处理";

    private ProductDeliveryContentPolicy() {
    }

    static String configurationError(Product product) {
        if ("CDK_EMAIL".equalsIgnoreCase(product.getDeliveryType())) {
            return null;
        }
        String instructions = product.getDeliveryInstructions();
        return instructions == null || instructions.isBlank()
                ? MISSING_DELIVERY_CONTENT : null;
    }
}
