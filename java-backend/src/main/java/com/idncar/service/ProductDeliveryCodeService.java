package com.idncar.service;

import com.idncar.model.dto.ImportProductDeliveryCodesRequest;
import com.idncar.model.dto.ImportProductDeliveryCodesResponse;
import com.idncar.model.dto.PageResultDto;
import com.idncar.model.dto.ProductDeliveryCodeDto;
import com.idncar.model.dto.ProductDeliveryCodeStatsDto;
import com.idncar.model.entity.PaymentOrder;
import com.idncar.model.entity.Product;

import java.util.List;

public interface ProductDeliveryCodeService {

    PageResultDto<ProductDeliveryCodeDto> getAdminDeliveryCodes(Long adminUserId, Integer page, Integer size, String keyword, Long productId, String status);

    ProductDeliveryCodeStatsDto getAdminDeliveryCodeStats(Long adminUserId);

    ImportProductDeliveryCodesResponse importDeliveryCodes(Long adminUserId, ImportProductDeliveryCodesRequest request);

    String exportAdminDeliveryCodesCsv(Long adminUserId, String keyword, Long productId, String status);

    void requireAvailableDeliveryCode(Product product);

    String fulfillPaidOrder(PaymentOrder order);

    void resendPaidOrder(PaymentOrder order);

    ProductDeliveryCodeDto resendDeliveryCode(Long adminUserId, Long codeId);

    ProductDeliveryCodeDto disableDeliveryCode(Long adminUserId, Long codeId);

    List<ProductDeliveryCodeDto> disableDeliveryCodeBatch(Long adminUserId, String batchNo);
}
